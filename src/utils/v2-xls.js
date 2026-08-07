'use strict';

import xlsx from 'node-xlsx';
import { v4 as uuidv4 } from 'uuid';

import { sequelizeV2 } from '../database/v2/index.js';
import StagingV2 from '../models/v2/staging-v2.model.js';
import OrganizationsV2 from '../models/v2/organizations-v2.model.js';
import { createXlsFromSequelizeResults, transformMetaUid } from './xls.js';
import { validateStagedRecord } from './v2-staging-validation.js';
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

// Spreadsheet cells carry native types, so numeric-looking values (e.g. a
// rating of 4.2) arrive as numbers even when the column is a string in the
// model and the API schema. Coerce those to strings so imports match what
// the REST API receives as JSON. Date cells (parsed with cellDates: true)
// and raw Excel date serials in date columns become YYYY-MM-DD strings.
const STRINGISH_TYPE_KEYS = new Set(['STRING', 'TEXT', 'CHAR', 'CITEXT', 'UUID']);
const DATE_TYPE_KEYS = new Set(['DATE', 'DATEONLY']);

// Days between the Excel epoch (1900-01-01, with the fictional 1900 leap day)
// and the Unix epoch.
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

function formatDateOnly(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// SheetJS (cellDates: true) converts a serial to UTC and then rebuilds the
// Date from those parts in local time, so the local components — not the UTC
// ones — carry the spreadsheet's calendar date. Joi.date() would accept the
// Date itself, but staging must carry the same JSON string the REST API
// receives.
function formatLocalDateOnly(date) {
  return formatDateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

// Serials never carry a timezone, so the conversion is pure UTC arithmetic and
// the UTC components are read back. Serials whose whole-day part is at or
// below 60 are shifted by a day because Excel counts a 1900-02-29 that never
// existed; SheetJS applies the same shift to date cells, so both parsing paths
// land on the same calendar date for the same serial. The gate reads the whole
// day so a fractional serial follows the day it belongs to.
function excelSerialToDateOnly(serial) {
  const shifted = Math.floor(serial) > 60 ? serial : serial + 1;
  const date = new Date(Math.round((shifted - EXCEL_EPOCH_OFFSET_DAYS) * 86400 * 1000));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDateOnly(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

// Convert Date cells to YYYY-MM-DD in place. Must run before transformMetaUid,
// which JSON round-trips the sheets and would mangle Dates into full ISO
// strings with a timezone offset baked in.
function normalizeDateCells(xlsxParsed) {
  for (const sheet of xlsxParsed) {
    for (const row of sheet.data ?? []) {
      for (let i = 0; i < row.length; i++) {
        if (row[i] instanceof Date) {
          row[i] = formatLocalDateOnly(row[i]);
        }
      }
    }
  }
  return xlsxParsed;
}

function coerceCellForModel(modelClass, column, value) {
  if (typeof value !== 'number') return value;
  const meta = modelClass.rawAttributes[column];
  const typeKey = meta?.type?.key;
  if (DATE_TYPE_KEYS.has(typeKey)) {
    // A bare number in a date column is an Excel date serial; interpreting it
    // as-is would let Joi.date() treat it as a Unix timestamp and stage a
    // wrong date. Values outside Date range fall through so Joi rejects them
    // with row context.
    return excelSerialToDateOnly(value) ?? value;
  }
  if (STRINGISH_TYPE_KEYS.has(typeKey)) {
    return String(value);
  }
  return value;
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
  // cellDates: true makes Excel-native date cells arrive as Date objects
  // instead of raw serial numbers, so normalizeDateCells can format them.
  const xlsxParsed = transformMetaUid(
    normalizeDateCells(xlsx.parse(fileBuffer, { cellDates: true })),
  );

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

    const sheetModel = match.type === 'main' ? schema.model : match.child.model;

    const headerRow = data[0];
    const rows = data.slice(1).map((row) => {
      const obj = {};
      headerRow.forEach((col, i) => {
        // Missing/empty cells become explicit nulls so trailing columns are
        // never silently dropped and validation sees the absent value.
        const val = i >= row.length ? null : row[i];
        obj[col] =
          val === 'null' || val === undefined
            ? null
            : coerceCellForModel(sheetModel, col, val);
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
 * Blank cells become null. The parser reports a blank cell in a declared
 * column as '', which would otherwise be staged as an empty string and read
 * back as a value; null is what "no value supplied" means everywhere else,
 * and it keeps a cleared field out of IS NOT NULL results downstream.
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
    result[normalized] = value === '' ? null : value;
  }
  return result;
}

/**
 * Convert a DB-field row (snake_case) back to Sequelize attribute names
 * (camelCase). This is used when reconciling pending staging rows with a new
 * CSV batch row so we can merge everything in one consistent key space before
 * converting back to DB field names for staging.
 *
 * @param {Object} row
 * @param {import('sequelize').Model} modelClass
 * @returns {Object} row with attribute-style keys where possible
 */
export function toAttributeNames(row, modelClass) {
  const snakeToCamel = buildSnakeToCamelMap(modelClass);
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel.get(key) || key] = value;
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
 *
 * Array values are serialized to JSON strings, matching the REST controllers
 * (e.g. project_sector: JSON.stringify([...])).  The commit pipeline's XLS
 * transformation drops object-valued columns, so an array staged raw would be
 * silently omitted from the on-chain record.
 */
export function toDbFieldNames(row, modelClass) {
  const attrs = modelClass.rawAttributes;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const attr = attrs[key];
    result[attr && attr.field ? attr.field : key] = Array.isArray(value)
      ? JSON.stringify(value)
      : value;
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
 * are auto-managed (primary key, orgUid, timestamps).
 *
 * @param {Object} row - camelCase row to validate
 * @param {import('sequelize').Model} modelClass
 * @returns {string[]} array of missing field names (empty if valid)
 */
export function validateRequiredFields(row, modelClass) {
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
    if (meta.allowNull === false && !autoManaged.has(attrName)) {
      const val = row[attrName];
      if (val === undefined || val === null || val === '') {
        missing.push(attrName);
      }
    }
  }
  return missing;
}

function getPrimaryKeyDbField(modelClass) {
  const pkAttr = modelClass.primaryKeyAttribute;
  return modelClass.rawAttributes[pkAttr]?.field || pkAttr;
}

function extractMatchingStagedRecord(stagingRecord, pk, modelClass, primaryKeyDbField) {
  try {
    const parsedData = JSON.parse(stagingRecord.data);
    const records = Array.isArray(parsedData) ? parsedData : [parsedData];
    const primaryKeyAttr = modelClass.primaryKeyAttribute;
    const matchedIndex = records.findIndex(
      (record) =>
        record && (record[primaryKeyDbField] === pk || record[primaryKeyAttr] === pk),
    );
    if (matchedIndex === -1) {
      return null;
    }

    return {
      stagingRecord,
      recordData: records[matchedIndex],
      recordCount: records.length,
    };
  } catch (error) {
    loggerV2.warn('[v2]: Failed to parse pending staging row during CSV merge', {
      stagingId: stagingRecord.id,
      uuid: stagingRecord.uuid,
      table: stagingRecord.table,
      error: error.message,
    });
    return null;
  }
}

/**
 * Return pending staging rows for a specific model primary key. Results are
 * sorted oldest to newest so callers can replay staged edits in order.
 *
 * @param {import('sequelize').Model} modelClass
 * @param {string} pk
 * @param {{ transaction?: import('sequelize').Transaction, actions?: string[] }} [options]
 * @returns {Promise<Array<{ stagingRecord: Object, recordData: Object }>>}
 */
export async function getPendingStagedRowsForPk(
  modelClass,
  pk,
  { transaction, actions = ['INSERT', 'UPDATE'] } = {},
) {
  const primaryKeyDbField = getPrimaryKeyDbField(modelClass);
  const stagedRows = await StagingV2.findAll({
    where: {
      table: modelClass.getTableName(),
      committed: false,
      failed_commit: false,
      is_transfer: false,
      action: actions,
    },
    order: [['id', 'ASC']],
    transaction,
  });

  return stagedRows
    .map((stagingRecord) =>
      extractMatchingStagedRecord(stagingRecord, pk, modelClass, primaryKeyDbField))
    .filter(Boolean);
}

/**
 * Build the latest logical row for a record by replaying any pending staging
 * rows on top of the committed DB row. This lets CSV batch uploads reconcile
 * with already-staged edits instead of clobbering them.
 *
 * Performs a single staging table scan and buckets results by action client
 * side, then returns the INSERT/UPDATE pending rows so the caller can hand
 * them to stageConsolidatedCsvRecord without scanning the staging table a
 * second time.
 *
 * @param {import('sequelize').Model} modelClass
 * @param {string} pk
 * @param {Object|null} persistedRecord - Sequelize instance or null
 * @param {{ transaction?: import('sequelize').Transaction }} [options]
 * @returns {Promise<{ mergedBase: Object, pendingRows: Array, hasPendingDelete: boolean, hasMultiRecordPendingRow: boolean }>}
 */
export async function buildPendingCsvMergeBase(
  modelClass,
  pk,
  persistedRecord,
  { transaction } = {},
) {
  const allPendingRows = await getPendingStagedRowsForPk(modelClass, pk, {
    transaction,
    actions: ['DELETE', 'INSERT', 'UPDATE'],
  });

  const pendingRows = [];
  let hasPendingDelete = false;
  for (const entry of allPendingRows) {
    if (entry.stagingRecord.action === 'DELETE') {
      hasPendingDelete = true;
    } else {
      pendingRows.push(entry);
    }
  }

  let mergedBase = persistedRecord ? persistedRecord.toJSON() : {};
  const hasMultiRecordPendingRow = pendingRows.some(
    ({ recordCount }) => recordCount > 1,
  );
  for (const { recordData } of pendingRows) {
    mergedBase = {
      ...mergedBase,
      ...toAttributeNames(recordData, modelClass),
    };
  }

  return {
    mergedBase,
    pendingRows,
    hasPendingDelete,
    hasMultiRecordPendingRow,
  };
}

/**
 * Write a single consolidated pending staging row for the given record. If
 * prior pending INSERT/UPDATE rows exist for the same PK, update the newest
 * one in place and delete older duplicates so the changelist sees one final
 * staged row.
 *
 * If any existing pending row is an INSERT, the consolidated row remains an
 * INSERT because the record has not been committed yet.
 *
 * Callers that already have the pending INSERT/UPDATE rows in hand (e.g. from
 * buildPendingCsvMergeBase during the same row of a CSV batch) may pass them
 * via options.pendingRows to avoid re-scanning the staging table.
 *
 * @param {import('sequelize').Model} modelClass
 * @param {string} pk
 * @param {'INSERT'|'UPDATE'} action
 * @param {Object} cleanedRecord - DB-field (snake_case) row
 * @param {import('sequelize').Transaction} transaction
 * @param {{ pendingRows?: Array<{ stagingRecord: Object }> }} [options]
 * @returns {Promise<void>}
 */
export async function stageConsolidatedCsvRecord(
  modelClass,
  pk,
  action,
  cleanedRecord,
  transaction,
  { pendingRows } = {},
) {
  // Staged records become on-chain DataLayer values verbatim, and a record
  // missing a NOT NULL column halts sync for every subscriber. This is the
  // last check on the bytes actually being written, independent of whatever
  // the caller validated on its own copy of the record.
  const missingNotNull = validateRequiredFields(
    toAttributeNames(cleanedRecord, modelClass),
    modelClass,
  );
  if (missingNotNull.length > 0) {
    throw new Error(
      `Record is missing required NOT NULL field(s): ${missingNotNull.join(', ')}`,
    );
  }

  // Callers pass an Array (possibly empty) when they already know the
  // pending INSERT/UPDATE rows. Anything else — undefined/null — means
  // "unknown, please scan". Guarding on Array.isArray avoids accidentally
  // re-scanning when a caller explicitly passes `[]` (known-empty).
  const resolvedPendingRows = Array.isArray(pendingRows)
    ? pendingRows
    : await getPendingStagedRowsForPk(modelClass, pk, {
        transaction,
        actions: ['INSERT', 'UPDATE'],
      });

  const effectiveAction = resolvedPendingRows.some(
    ({ stagingRecord }) => stagingRecord.action === 'INSERT',
  )
    ? 'INSERT'
    : action;

  if (resolvedPendingRows.length > 0) {
    const targetRow = resolvedPendingRows[resolvedPendingRows.length - 1].stagingRecord;
    const duplicateIds = resolvedPendingRows
      .slice(0, -1)
      .map(({ stagingRecord }) => stagingRecord.id);

    // Keep the staging row's uuid column in sync with the entity PK. The
    // staging table convention is that uuid === entity primary key, and
    // downstream commit logic uses it as the datalayer changelist key; a
    // stale uuid from a prior staging row would produce the wrong changelist
    // entry.
    await StagingV2.update(
      {
        uuid: pk,
        action: effectiveAction,
        data: JSON.stringify([cleanedRecord]),
      },
      {
        where: { id: targetRow.id },
        transaction,
      },
    );

    if (duplicateIds.length > 0) {
      await StagingV2.destroy({
        where: { id: duplicateIds },
        transaction,
      });
    }
    return;
  }

  await StagingV2.upsert(
    {
      uuid: pk,
      action: effectiveAction,
      table: modelClass.getTableName(),
      data: JSON.stringify([cleanedRecord]),
    },
    { transaction },
  );
}

/**
 * Create StagingV2 records from parsed XLSX data.
 * Parent rows and child rows each get their own staging entry, matching the
 * V2 architecture where every model has its own staging / changelist flow.
 *
 * Every row must pass validateStagedRecord (the same Joi + FK + NOT NULL
 * rules the REST API applies) before anything is staged — staged records
 * become on-chain DataLayer values verbatim, and an incomplete record halts
 * sync for every subscriber. See src/utils/v2-staging-validation.js.
 *
 * @param {{ main: Object[], children: Object.<string, Object[]> }} parsedData
 * @param {import('sequelize').Model} model - Sequelize V2 model class
 * @throws {Error} Aggregate row-level validation error; nothing is staged.
 */
export async function stageV2XlsRecords(parsedData, model) {
  const schema = buildXlsSchema(model);

  const isEmptyRow = (row) =>
    Object.values(row).every((v) => v === null || v === undefined || v === '');

  // The normal V2 API controllers inject org_uid from the home organization
  // into every staged record. The XLSX path must do the same so the data
  // pushed to datalayer includes org_uid (allowNull: false on parent models).
  const homeOrg = await OrganizationsV2.getHomeOrg(false);
  if (!homeOrg) {
    throw new Error('Cannot stage XLSX records: no home organization found');
  }
  const orgUid = homeOrg.org_uid;

  // Phase 1: prepare all rows (merge with existing records, assign PKs)
  // without writing anything.
  const entries = [];

  for (let i = 0; i < parsedData.main.length; i++) {
    const row = parsedData.main[i];
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

    entries.push({
      modelClass: model,
      tableName: model.getTableName(),
      sheetName: schema.mainSheetName,
      rowNumber: i + 2, // 1-indexed + header row
      uuid,
      action: existingRecord ? 'UPDATE' : 'INSERT',
      stagedRecord,
      injectOrgUid: Boolean(model.rawAttributes.orgUid),
      pk: stagedRecord[schema.mainPK],
    });
  }

  for (const child of schema.children) {
    const rows = parsedData.children[child.sheetName];
    if (!rows || rows.length === 0) continue;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (isEmptyRow(row)) continue;

      parseArrayFields(row);

      const pkValue = row[child.primaryKey];
      let existingRecord = null;
      if (pkValue) {
        existingRecord = await child.model.findByPk(pkValue);
      }

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

      entries.push({
        modelClass: child.model,
        tableName: child.tableName,
        sheetName: child.sheetName,
        rowNumber: i + 2,
        uuid,
        action: existingRecord ? 'UPDATE' : 'INSERT',
        stagedRecord,
        injectOrgUid: false,
        pk: stagedRecord[child.primaryKey],
      });
    }
  }

  // Phase 2: validate every row before staging anything. FKs may reference
  // records staged in this same batch, so collect the batch PKs first.
  const batchPks = {};
  for (const entry of entries) {
    if (!batchPks[entry.tableName]) {
      batchPks[entry.tableName] = new Set();
    }
    batchPks[entry.tableName].add(entry.pk);
  }

  const validationErrors = [];
  for (const entry of entries) {
    // Validate a normalized copy: merged values from existing DB rows may
    // hold JSON-array strings (e.g. projectSector) that the schema expects
    // as arrays. Staged data itself is left untouched.
    const validationRow = { ...entry.stagedRecord };
    parseArrayFields(validationRow);

    const rowErrors = await validateStagedRecord(
      entry.modelClass,
      validationRow,
      { batchPks },
    );
    for (const message of rowErrors) {
      validationErrors.push(
        `[${entry.sheetName} row ${entry.rowNumber}] ${message}`,
      );
    }
  }

  if (validationErrors.length > 0) {
    const MAX_REPORTED_ERRORS = 50;
    const reported = validationErrors.slice(0, MAX_REPORTED_ERRORS);
    const suffix =
      validationErrors.length > MAX_REPORTED_ERRORS
        ? `; …and ${validationErrors.length - MAX_REPORTED_ERRORS} more`
        : '';
    throw new Error(
      `Import validation failed — nothing was staged. ${reported.join('; ')}${suffix}`,
    );
  }

  // Phase 3: stage all rows
  await sequelizeV2.transaction(async (transaction) => {
    for (const entry of entries) {
      const dbRecord = toDbFieldNames(entry.stagedRecord, entry.modelClass);

      if (entry.injectOrgUid) {
        dbRecord.org_uid = orgUid;
      }

      await StagingV2.upsert(
        {
          uuid: entry.uuid,
          action: entry.action,
          table: entry.tableName,
          data: JSON.stringify([dbRecord]),
        },
        { transaction },
      );
    }
  });
}
