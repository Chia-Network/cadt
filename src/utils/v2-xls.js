'use strict';

import xlsx from 'node-xlsx';
import { v4 as uuidv4 } from 'uuid';

import { sequelizeV2 } from '../database/v2/index.js';
import StagingV2 from '../models/v2/staging-v2.model.js';
import OrganizationsV2 from '../models/v2/organizations-v2.model.js';
import { createXlsFromSequelizeResults, transformMetaUid } from './xls.js';
import { loggerV2 } from '../config/logger.js';

/**
 * Derives an XLS schema from Sequelize model metadata.
 * Uses associations, primary keys, and the model's xlsSheetName property
 * so that no separate config needs to be maintained.
 *
 * @param {import('sequelize').Model} model - Sequelize V2 model class
 * @returns {{ model, mainSheetName: string, mainPK: string, modelSheetKey: string, children: Array }}
 */
export function buildXlsSchema(model) {
  const mainPK = model.primaryKeyAttributes[0];
  const mainSheetName = model.xlsSheetName;
  const modelSheetKey = model.name;

  const children = Object.values(model.associations)
    .filter((a) => a.associationType === 'HasMany')
    .map((assoc) => ({
      model: assoc.target,
      sheetName: assoc.as,
      primaryKey: assoc.target.primaryKeyAttributes[0],
      foreignKey: assoc.foreignKey,
      tableName: assoc.target.getTableName(),
    }));

  return { model, mainSheetName, mainPK, modelSheetKey, children };
}

/**
 * Build an XLSX buffer for a V2 model including all HasMany children.
 *
 * @param {Object[]} rows - Sequelize result rows (plain objects or instances)
 * @param {import('sequelize').Model} model - Sequelize V2 model class
 * @returns {Buffer} XLSX file buffer
 */
export function createV2Xls(rows, model) {
  const schema = buildXlsSchema(model);

  const xlsData = createXlsFromSequelizeResults({
    rows,
    model,
    toStructuredCsv: true,
  });

  // Rename main sheet from model.name (e.g. "ProjectV2") to xlsSheetName (e.g. "projects")
  if (xlsData[schema.modelSheetKey]) {
    xlsData[schema.mainSheetName] = xlsData[schema.modelSheetKey];
    xlsData[schema.mainSheetName].name = schema.mainSheetName;
    delete xlsData[schema.modelSheetKey];
  }

  const orderedSheets = [];
  if (xlsData[schema.mainSheetName]) {
    orderedSheets.push(xlsData[schema.mainSheetName]);
  }

  Object.entries(xlsData).forEach(([sheetName, sheetData]) => {
    if (sheetName !== schema.mainSheetName) {
      orderedSheets.push(sheetData);
    }
  });

  return xlsx.build(orderedSheets);
}

/**
 * Naive English singularization for common plural suffixes.
 * Handles -ies → -y (e.g. "projectMethodologies" → "projectMethodology"),
 * -ses/-xes/-zes → drop trailing "es", and plain -s removal.
 */
function naiveSingular(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Parse an XLSX buffer into structured data for a V2 model.
 *
 * @param {Buffer} fileBuffer - Raw XLSX file buffer
 * @param {import('sequelize').Model} model - Sequelize V2 model class
 * @returns {{ main: Object[], children: Object.<string, Object[]> }}
 */
export function parseV2Xlsx(fileBuffer, model) {
  const schema = buildXlsSchema(model);
  const xlsxParsed = transformMetaUid(xlsx.parse(fileBuffer));

  // Build a lookup: sheetName → { type: 'main' | 'child', childInfo? }
  const sheetLookup = {};

  // Main sheet can match by plural or singular
  const mainSingular = naiveSingular(schema.mainSheetName);
  sheetLookup[schema.mainSheetName] = { type: 'main' };
  sheetLookup[mainSingular] = { type: 'main' };
  // Also accept the model name (e.g. "ProjectV2")
  sheetLookup[schema.modelSheetKey] = { type: 'main' };

  for (const child of schema.children) {
    const singularChild = naiveSingular(child.sheetName);
    sheetLookup[child.sheetName] = { type: 'child', child };
    sheetLookup[singularChild] = { type: 'child', child };
    sheetLookup[child.model.name] = { type: 'child', child };
  }

  const mainRows = [];
  const childRows = {};

  for (const { data, name } of xlsxParsed) {
    if (!data || data.length < 2) continue;

    const match = sheetLookup[name];
    if (!match) continue;

    const headerRow = data[0];
    const rows = data.slice(1).map((row) => {
      const obj = {};
      headerRow.forEach((col, i) => {
        if (i >= row.length) return; // skip missing trailing cells
        const val = row[i];
        obj[col] = val === 'null' ? null : val;
      });
      return obj;
    });

    if (match.type === 'main') {
      mainRows.push(...rows);
    } else {
      const sheetName = match.child.sheetName;
      if (!childRows[sheetName]) childRows[sheetName] = [];
      childRows[sheetName].push(...rows);
    }
  }

  return { main: mainRows, children: childRows };
}

/**
 * Parse JSON strings that look like arrays. ProjectV2 stores projectType and
 * projectSector as JSON arrays in the DB, but XLSX cells arrive as plain strings.
 */
function parseArrayFields(row) {
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            row[key] = parsed;
          }
        } catch {
          // leave as-is
        }
      }
    }
  }
}

/**
 * Build a reverse lookup from snake_case DB field names to camelCase Sequelize
 * attribute names for a model.  Used to normalize CSV headers that may arrive
 * in either convention.
 *
 * @param {import('sequelize').Model} modelClass
 * @returns {Map<string, string>} snake_case field -> camelCase attribute
 */
function buildSnakeToCamelMap(modelClass) {
  const map = new Map();
  for (const [attrName, meta] of Object.entries(modelClass.rawAttributes)) {
    const dbField = meta.field || attrName;
    if (dbField !== attrName) {
      map.set(dbField, attrName);
    }
  }
  return map;
}

/**
 * Normalize a CSV row so that every key is a camelCase Sequelize attribute
 * name.  Accepts headers in either camelCase or snake_case.  Keys that don't
 * map to any known attribute are left as-is so they can be stripped later.
 *
 * @param {Object} row
 * @param {import('sequelize').Model} modelClass
 * @returns {Object} row with normalized keys
 */
export function normalizeCsvHeaders(row, modelClass) {
  const snakeToCamel = buildSnakeToCamelMap(modelClass);
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = snakeToCamel.get(key) || key;
    result[normalized] = value;
  }
  return result;
}

/**
 * Convert a row object from camelCase attribute names to snake_case DB field
 * names using the model's rawAttributes metadata. Keys not present in
 * rawAttributes are kept as-is (they may already be snake_case or custom).
 *
 * V2 models use `underscored: true`, so Sequelize attribute names are camelCase
 * (e.g. cadTrustProjectId) while the DB columns are snake_case
 * (e.g. cad_trust_project_id).  The V2 commit pipeline
 * (generateChangeListFromStagedData → transformFullXslsToChangeList) expects
 * staging data to use snake_case field names, matching what the normal API
 * controllers produce.
 */
export function toDbFieldNames(row, modelClass) {
  const attrs = modelClass.rawAttributes;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const attr = attrs[key];
    result[attr && attr.field ? attr.field : key] = value;
  }
  return result;
}

/**
 * Strip keys from a snake_case DB-field row that are not valid DB column names
 * for the given model.  Returns a new object containing only recognized fields.
 * Logs a warning for every stripped key so users can catch CSV header mistakes.
 *
 * @param {Object} dbRow - Row already converted to snake_case via toDbFieldNames
 * @param {import('sequelize').Model} modelClass
 * @param {import('../config/logger.js').loggerV2} [logger] - optional logger
 * @returns {Object} cleaned row
 */
export function stripUnknownDbFields(dbRow, modelClass, logger = null) {
  const validFields = new Set();
  for (const meta of Object.values(modelClass.rawAttributes)) {
    validFields.add(meta.field || meta.fieldName);
  }
  // Also accept Sequelize-managed timestamp fields
  validFields.add('created_at');
  validFields.add('updated_at');

  const cleaned = {};
  for (const [key, value] of Object.entries(dbRow)) {
    if (validFields.has(key)) {
      cleaned[key] = value;
    } else if (logger) {
      logger.warn(`[v2]: Stripping unknown CSV column '${key}' — not a valid DB field`);
    }
  }
  return cleaned;
}

/**
 * Validate that a camelCase row destined for INSERT contains all fields
 * marked `allowNull: false` in the model definition.  Skips fields that
 * are auto-managed (primary key, orgUid, timestamps) and any fields listed
 * in the optional `skipFields` set (e.g. `unitSerialId` when it can be
 * derived from other fields).
 *
 * @param {Object} row - camelCase row to validate
 * @param {import('sequelize').Model} modelClass
 * @param {Set<string>} [skipFields] - attribute names to skip
 * @returns {string[]} array of missing field names (empty if valid)
 */
export function validateRequiredFields(row, modelClass, skipFields = new Set()) {
  const autoManaged = new Set([
    modelClass.primaryKeyAttribute,
    'orgUid',
    'createdAt',
    'updatedAt',
    // Models with underscored:true and custom timestamp mappings use
    // snake_case attribute names in rawAttributes
    'created_at',
    'updated_at',
  ]);

  const missing = [];
  for (const [attrName, meta] of Object.entries(modelClass.rawAttributes)) {
    if (meta.allowNull === false && !autoManaged.has(attrName) && !skipFields.has(attrName)) {
      const val = row[attrName];
      if (val === undefined || val === null || val === '') {
        missing.push(attrName);
      }
    }
  }
  return missing;
}

/**
 * Create StagingV2 records from parsed XLSX data.
 * Parent rows and child rows each get their own staging entry, matching the
 * V2 architecture where every model has its own staging / changelist flow.
 *
 * @param {{ main: Object[], children: Object.<string, Object[]> }} parsedData
 * @param {import('sequelize').Model} model - Sequelize V2 model class
 */
export async function stageV2XlsRecords(parsedData, model) {
  const schema = buildXlsSchema(model);

  const isEmptyRow = (row) =>
    Object.values(row).every((v) => v === null || v === undefined || v === '');

  // The normal V2 API controllers inject org_uid from the home organization
  // into every staged record. The XLSX path must do the same so the data
  // pushed to datalayer includes org_uid — otherwise sync-registries-v2
  // fails with SequelizeUniqueConstraintError when upserting the record
  // back (org_uid has allowNull: false on parent models).
  const homeOrg = await OrganizationsV2.getHomeOrg(false);
  if (!homeOrg) {
    throw new Error('Cannot stage XLSX records: no home organization found');
  }
  const orgUid = homeOrg.org_uid;

  await sequelizeV2.transaction(async (transaction) => {
    // Stage parent rows
    for (const row of parsedData.main) {
      if (isEmptyRow(row)) continue;

      parseArrayFields(row);

      // Let the model apply domain-specific transforms (e.g. derive unitSerialId)
      if (typeof model.prepareXlsRow === 'function') {
        model.prepareXlsRow(row);
      }

      const pkValue = row[schema.mainPK];
      let existingRecord = null;
      if (pkValue) {
        existingRecord = await model.findByPk(pkValue);
      }

      const exists = Boolean(existingRecord);
      const uuid = pkValue || uuidv4();

      // Merge with existing record if updating
      let stagedRecord;
      if (existingRecord) {
        stagedRecord = {
          ...existingRecord.dataValues,
          ...row,
        };
      } else {
        stagedRecord = { ...row };
        if (!stagedRecord[schema.mainPK]) {
          stagedRecord[schema.mainPK] = uuid;
        }
      }

      // Remove child array keys from parent staging data
      for (const child of schema.children) {
        delete stagedRecord[child.sheetName];
      }

      const dbRecord = toDbFieldNames(stagedRecord, model);

      if (model.rawAttributes.orgUid) {
        dbRecord.org_uid = orgUid;
      }

      await StagingV2.upsert(
        {
          uuid,
          action: exists ? 'UPDATE' : 'INSERT',
          table: model.getTableName(),
          data: JSON.stringify([dbRecord]),
        },
        { transaction },
      );
    }

    // Stage child rows independently
    for (const child of schema.children) {
      const rows = parsedData.children[child.sheetName];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        if (isEmptyRow(row)) continue;

        parseArrayFields(row);

        const pkValue = row[child.primaryKey];
        let existingRecord = null;
        if (pkValue) {
          existingRecord = await child.model.findByPk(pkValue);
        }

        const exists = Boolean(existingRecord);
        const uuid = pkValue || uuidv4();

        let stagedRecord;
        if (existingRecord) {
          stagedRecord = {
            ...existingRecord.dataValues,
            ...row,
          };
        } else {
          stagedRecord = { ...row };
          if (!stagedRecord[child.primaryKey]) {
            stagedRecord[child.primaryKey] = uuid;
          }
        }

        const dbRecord = toDbFieldNames(stagedRecord, child.model);

        await StagingV2.upsert(
          {
            uuid,
            action: exists ? 'UPDATE' : 'INSERT',
            table: child.tableName,
            data: JSON.stringify([dbRecord]),
          },
          { transaction },
        );
      }
    }
  });
}
