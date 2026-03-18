'use strict';

import xlsx from 'node-xlsx';
import { v4 as uuidv4 } from 'uuid';

import { sequelizeV2 } from '../database/v2/index.js';
import StagingV2 from '../models/v2/staging-v2.model.js';
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

  return xlsx.build(Object.values(xlsData));
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

      await StagingV2.upsert(
        {
          uuid,
          action: exists ? 'UPDATE' : 'INSERT',
          table: model.getTableName(),
          data: JSON.stringify([stagedRecord]),
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

        await StagingV2.upsert(
          {
            uuid,
            action: exists ? 'UPDATE' : 'INSERT',
            table: child.tableName,
            data: JSON.stringify([stagedRecord]),
          },
          { transaction },
        );
      }
    }
  });
}
