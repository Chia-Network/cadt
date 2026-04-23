'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import * as rxjs from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import csv from 'csvtojson';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { UnitV2Mirror } from './unit-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import OrganizationsV2 from './organizations-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import {
  parseV2Xlsx,
  stageV2XlsRecords,
  normalizeCsvHeaders,
  toDbFieldNames,
  stripUnknownDbFields,
  validateRequiredFields,
  buildPendingCsvMergeBase,
  stageConsolidatedCsvRecord,
} from '../../utils/v2-xls.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';
import { IssuanceV2 } from './issuance-v2.model.js';
import { getDeletedItems } from '../../utils/model-utils.js';
import { UnitLabelV2 } from './unit-label-v2.model.js';
import { loggerV2 } from '../../config/logger.js';
import { sanitizeSqliteFtsQuery } from '../../utils/v2-fts-utils.js';
import { convertToCamelCase } from '../../utils/v2-camel-to-snake.js';

class UnitV2 extends Model {
  static changes = new rxjs.Subject();
  static xlsSheetName = 'units';

  /**
   * Derive unitSerialId from block range when not explicitly provided.
   * Called by stageV2XlsRecords before staging each imported row.
   */
  static prepareXlsRow(row) {
    if (!row.unitSerialId && row.unitStartBlock && row.unitEndBlock) {
      row.unitSerialId = `${row.unitStartBlock}-${row.unitEndBlock}`;
    }
  }

  static associate(models) {
    // Unit belongs to Issuance
    UnitV2.belongsTo(models.IssuanceV2, {
      foreignKey: 'cadTrustIssuanceId',
      as: 'issuance',
    });

    // Unit has many UnitLabels (many-to-many with Label)
    UnitV2.hasMany(models.UnitLabelV2, {
      foreignKey: 'cadTrustUnitId',
      as: 'unitLabels',
    });
  }

  /**
   * Returns associated models for UnitV2
   * Used by getDeletedItems to identify child records
   * @returns {Array} Array of associated model objects
   */
  static getAssociatedModels = () => [{ model: UnitLabelV2, pluralize: true }];

  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await UnitV2Mirror.create(values, mirrorOptions);
    });

    const createResult = await super.create(values, options);
    const { org_uid } = createResult;
    UnitV2.changes.next(['units', org_uid]);

    return createResult;
  }

  static async upsert(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await UnitV2Mirror.upsert(values, mirrorOptions);
    });

    const upsertResult = await super.upsert(values, options);
    const { org_uid } = values;
    // Note: Following V1 pattern, upsert emits 'projects' not 'units'
    UnitV2.changes.next(['projects', org_uid]);

    return upsertResult;
  }

  static async destroy(options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await UnitV2Mirror.destroy(mirrorOptions);
    });

    UnitV2.changes.next(['units']);
    const result = await super.destroy(options);

    return result;
  }

  /**
   * Generates changelist from staged data for UnitV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with unit and child table changes
   */
  static async generateChangeListFromStagedData(
    stagedData,
    comment,
    author,
    registryId,
    isUpdateComment,
    isUpdateAuthor,
  ) {
    // PERFORMANCE: Early exit if no staged records for this model or its child tables
    // UnitV2 handles child table: unit_label
    const hasStagedData = stagedData.some(
      (record) => ['unit', 'unit_label'].includes(record.table),
    );
    if (!hasStagedData) {
      return {
        unit: [],
        unit_label: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'unit');

    const primaryKeyMap = {
      unit: 'cadTrustUnitId',
      unit_label: 'cadTrustUnitLabelId', // Primary key field name (Sequelize camelCase)
    };

    // PERFORMANCE: Only call getDeletedItems() if UPDATE records exist
    const deletedRecords =
      updateRecords.length > 0
        ? await getDeletedItems(
            updateRecords,
            primaryKeyMap,
            UnitV2,
            'unit',
          )
        : [];

    // Convert records to Excel format (only if records exist)
    // Staging data is in snake_case (database format), but createXlsFromSequelizeResults expects camelCase (Sequelize format)
    const convertedInsertRecords = insertRecords.length > 0
      ? insertRecords.map(record => {
          // Convert snake_case keys to camelCase
          const converted = {};
          for (const key in record) {
            if (record.hasOwnProperty(key)) {
              const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
              converted[camelKey] = record[key];
            }
          }
          // Explicitly ensure primary key is present (handle both formats)
          if (!converted.cadTrustUnitId) {
            converted.cadTrustUnitId = record.cad_trust_unit_id || record.cadTrustUnitId;
          }
          if (!converted.cadTrustUnitId) {
            loggerV2.error('[v2]: Missing primary key in unit insert record', { record });
            throw new Error('Missing primary key (cadTrustUnitId) in unit insert record');
          }
          return converted;
        })
      : [];
    const insertXslsSheets =
      convertedInsertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: convertedInsertRecords,
            model: UnitV2,
            toStructuredCsv: true,
          })
        : null;

    const convertedUpdateRecords = updateRecords.length > 0
      ? updateRecords.map(record => {
          // Convert snake_case keys to camelCase
          const converted = {};
          for (const key in record) {
            if (record.hasOwnProperty(key)) {
              const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
              converted[camelKey] = record[key];
            }
          }
          // Explicitly ensure primary key is present (handle both formats)
          if (!converted.cadTrustUnitId) {
            converted.cadTrustUnitId = record.cad_trust_unit_id || record.cadTrustUnitId;
          }
          if (!converted.cadTrustUnitId) {
            loggerV2.error('[v2]: Missing primary key in unit update record', { record });
            throw new Error('Missing primary key (cadTrustUnitId) in unit update record');
          }
          return converted;
        })
      : [];
    const updateXslsSheets =
      convertedUpdateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: convertedUpdateRecords,
            model: UnitV2,
            toStructuredCsv: true,
          })
        : null;

    // deletedRecords come from getDeletedItems which returns Sequelize instances (already camelCase)
    const deleteXslsSheets =
      deletedRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: deletedRecords.map(record => record.dataValues || record),
            model: UnitV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "UnitV2") to table name (e.g., "unit")
    // This is needed because createXlsFromSequelizeResults uses model.name as the key,
    // but transformFullXslsToChangeList expects keys matching primaryKeyMap
    // Also map child table sheet names if they exist
    const mapSheetNames = (xslsSheets, modelName, tableName) => {
      if (!xslsSheets) {
        return xslsSheets;
      }
      const mapped = { ...xslsSheets };
      if (mapped[modelName]) {
        mapped[tableName] = mapped[modelName];
        delete mapped[modelName];
      }
      // Map child table names if they exist
      const childMappings = {
        UnitLabelV2: 'unit_label',
      };
      Object.keys(childMappings).forEach((childModelName) => {
        if (mapped[childModelName]) {
          mapped[childMappings[childModelName]] = mapped[childModelName];
          delete mapped[childModelName];
        }
      });
      return mapped;
    };

    // Convert Excel to changelist (only if Excel sheets were created)
    // Pass V2 model map for checking existing records (including child tables)
    const modelMap = {
      unit: UnitV2,
      unit_label: UnitLabelV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, UnitV2.name, 'unit'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, UnitV2.name, 'unit'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const deletedAssociationsChangeList = deleteXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(deleteXslsSheets, UnitV2.name, 'unit'),
          'delete',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      unit: [
        ..._.get(insertChangeList, 'unit', []),
        ..._.get(updateChangeList, 'unit', []),
        ...deleteChangeList,
      ],
      unit_label: [
        ..._.get(insertChangeList, 'unit_label', []),
        ..._.get(updateChangeList, 'unit_label', []),
        ..._.get(deletedAssociationsChangeList, 'unit_label', []),
      ],
    };
  }

  /**
   * Split a unit into multiple units
   * @param {string} unitId - The cadTrustUnitId of the unit to split
   * @param {Array} records - Array of split records with unitCount, unitBlockStart, unitBlockEnd, etc.
   * @returns {Promise<void>}
   * @throws {Error} If unit doesn't exist, doesn't belong to home org, or split count doesn't match
   */
  static async split(unitId, records) {
    try {
      // Get original unit
      const originalRecord = await UnitV2.findByPk(unitId);
      if (!originalRecord) {
        throw new Error(`Unit with cadTrustUnitId ${unitId} does not exist`);
      }

      // Verify it belongs to home org
      const homeOrg = await OrganizationsV2.getHomeOrg();
      if (!homeOrg) {
        throw new Error('No home organization found');
      }

      let totalSplitCount = 0;

      // Create split records
      const splitRecords = await Promise.all(
        records.map(async (record, index) => {
          const newRecord = originalRecord.toJSON();

          // First record keeps original ID, others get new UUIDs
          if (index > 0) {
            newRecord.cadTrustUnitId = uuidv4();
          }

          // Update unit count and blocks
          newRecord.unitCount = record.unitCount;
          totalSplitCount += parseFloat(record.unitCount) || 0;

          // Handle both camelCase field names (unitBlockStart/unitBlockEnd from API)
          // and snake_case (unit_start_block/unit_end_block from database)
          const blockStart = record.unitBlockStart || record.unit_start_block;
          const blockEnd = record.unitBlockEnd || record.unit_end_block;

          if (blockStart && blockEnd) {
            newRecord.unitSerialId = `${blockStart}-${blockEnd}`;
            newRecord.unitStartBlock = blockStart;
            newRecord.unitEndBlock = blockEnd;
          }

          // Update optional fields if provided
          if (record.unitCurrentOwner !== undefined) {
            newRecord.unitCurrentOwner = record.unitCurrentOwner;
          }
          if (record.unitStatus !== undefined) {
            newRecord.unitStatus = record.unitStatus;
          }
          if (record.unitStatusReason !== undefined) {
            newRecord.unitStatusReason = record.unitStatusReason;
          }
          if (record.unitStatusDate !== undefined) {
            newRecord.unitStatusDate = record.unitStatusDate;
          }

          // Remove timestamps (handled automatically)
          delete newRecord.createdAt;
          delete newRecord.updatedAt;

          return newRecord;
        }),
      );

      // Validate total split count matches original
      const originalCount = parseFloat(originalRecord.unitCount) || 0;
      if (Math.abs(totalSplitCount - originalCount) > 0.0001) {
        throw new Error(
          `Total split count (${totalSplitCount}) does not match original unit count (${originalCount})`,
        );
      }

      // Create staging record with UPDATE action
      const stagingUuid = uuidv4();
      const stagedData = {
        uuid: stagingUuid,
        action: 'UPDATE',
        table: 'unit',
        data: JSON.stringify(splitRecords),
      };

      await StagingV2.create(stagedData);

      loggerV2.info(`[v2]: Unit ${unitId} split into ${splitRecords.length} units`);
      return { uuid: stagingUuid };
    } catch (error) {
      loggerV2.error('[v2]: Error splitting unit:', error);
      throw new Error(`Failed to split unit: ${error.message}`);
    }
  }

  /**
   * Update units from XLSX file
   * @param {Buffer} fileBuffer - XLSX file buffer
   * @returns {Promise<void>}
   * @throws {Error} If XLSX parsing or staging fails
   */
  static async updateFromXLS(fileBuffer) {
    try {
      const parsedData = parseV2Xlsx(fileBuffer, UnitV2);
      await stageV2XlsRecords(parsedData, UnitV2);
      loggerV2.info('[v2]: Units updated from XLSX file');
    } catch (error) {
      loggerV2.error('[v2]: Error updating units from XLSX:', error);
      throw new Error(`Failed to update units from XLSX: ${error.message}`);
    }
  }

  /**
   * Batch upload units from CSV file.
   *
   * Collects all CSV rows synchronously, then processes each row sequentially
   * inside a transaction.  For each row the pipeline is:
   *   1. Normalize snake_case headers → camelCase attribute names
   *   2. Apply domain transforms (prepareXlsRow derives unitSerialId)
   *   3. Determine INSERT vs UPDATE, merge with existing record on UPDATE
   *   4. Validate ownership and FK references
   *   5. Convert to DB field names, strip unknown keys
   *   6. Upsert into StagingV2
   *
   * @param {Object} csvFile - CSV file object with data buffer
   * @returns {Promise<Object>} { stagedCount, errorCount, errors }
   */
  static async batchUpload(csvFile) {
    const buffer = csvFile.data;
    const stream = Readable.from(buffer.toString('utf8'));

    const rawRows = [];

    await new Promise((resolve, reject) => {
      csv()
        .fromStream(stream)
        .subscribe((row) => {
          rawRows.push(row);
        })
        .on('error', (error) => reject(error))
        .on('done', () => resolve());
    });

    if (rawRows.length === 0) {
      throw new Error('There were no valid records to parse');
    }

    const homeOrg = await OrganizationsV2.getHomeOrg();
    if (!homeOrg) {
      throw new Error('No home organization found');
    }
    const orgUid = homeOrg.org_uid;

    const errors = [];
    let stagedCount = 0;

    // unitSerialId is derivable from blocks — don't require it if blocks are present
    const unitSkipFields = new Set(['unitSerialId']);

    await sequelizeV2.transaction(async (transaction) => {
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = i + 2; // +2: 1-indexed + header row
        try {
          let row = normalizeCsvHeaders(rawRows[i], UnitV2);

          // Derive unitSerialId from block range when not explicitly provided
          UnitV2.prepareXlsRow(row);

          const unitId = row.cadTrustUnitId;
          let action;
          let mergedRecord;

          let pendingRows = [];
          if (unitId) {
            const existing = await UnitV2.findByPk(unitId);
            const mergeResult = await buildPendingCsvMergeBase(
              UnitV2,
              unitId,
              existing,
              { transaction },
            );
            const {
              mergedBase,
              hasPendingDelete,
              hasMultiRecordPendingRow,
            } = mergeResult;
            pendingRows = mergeResult.pendingRows;

            if (hasPendingDelete) {
              errors.push({
                row: rowNum,
                error: `Cannot update unit ${unitId}: it already has a pending staged delete`,
              });
              continue;
            }
            if (hasMultiRecordPendingRow) {
              errors.push({
                row: rowNum,
                error: `Cannot update unit ${unitId}: it already has a complex pending staged update`,
              });
              continue;
            }
            if (!existing && Object.keys(mergedBase).length === 0) {
              errors.push({ row: rowNum, error: `Unit with cadTrustUnitId ${unitId} does not exist` });
              continue;
            }
            if (mergedBase.orgUid !== orgUid) {
              errors.push({ row: rowNum, error: `Cannot update unit ${unitId}: belongs to a different organization` });
              continue;
            }
            action = existing ? 'UPDATE' : 'INSERT';
            mergedRecord = { ...mergedBase, ...row };

            const changedBlockRange =
              !row.unitSerialId &&
              (row.unitStartBlock !== undefined || row.unitEndBlock !== undefined);
            if (changedBlockRange) {
              delete mergedRecord.unitSerialId;
              UnitV2.prepareXlsRow(mergedRecord);
            }
          } else {
            row.cadTrustUnitId = uuidv4();
            action = 'INSERT';
            mergedRecord = { ...row };
          }

          // Required-field validation for INSERT rows
          if (action === 'INSERT') {
            const missing = validateRequiredFields(mergedRecord, UnitV2, unitSkipFields);
            if (missing.length > 0) {
              errors.push({ row: rowNum, error: `Missing required field(s): ${missing.join(', ')}` });
              continue;
            }
          }

          // FK existence check for cadTrustIssuanceId
          if (mergedRecord.cadTrustIssuanceId) {
            try {
              await assertRecordExistanceOrStaged(
                IssuanceV2,
                mergedRecord.cadTrustIssuanceId,
                `cadTrustIssuanceId '${mergedRecord.cadTrustIssuanceId}' does not exist`,
              );
            } catch (err) {
              errors.push({ row: rowNum, error: err.message });
              continue;
            }
          }

          // Remove timestamps (managed by Sequelize)
          delete mergedRecord.createdAt;
          delete mergedRecord.updatedAt;
          delete mergedRecord.created_at;
          delete mergedRecord.updated_at;

          const dbRecord = toDbFieldNames(mergedRecord, UnitV2);
          const cleaned = stripUnknownDbFields(dbRecord, UnitV2, loggerV2);

          cleaned.org_uid = orgUid;

          await stageConsolidatedCsvRecord(
            UnitV2,
            mergedRecord.cadTrustUnitId,
            action,
            cleaned,
            transaction,
            { pendingRows },
          );
          stagedCount++;
        } catch (err) {
          errors.push({ row: rowNum, error: err.message });
        }
      }
    });

    return { stagedCount, errorCount: errors.length, errors };
  }


  /**
   * FTS search wrapper - detects dialect and calls appropriate method
   * @param {string} searchStr - Search query string
   * @param {Object} pagination - Pagination object with offset and limit
   * @param {Array} columns - Optional array of columns to select
   * @param {boolean} includeProjectInfo - Whether to include project info in search
   * @param {string} orgUid - Optional organization UID for filtering
   * @returns {Promise<Object>} - Object with count and rows
   */
  static async fts(searchStr, pagination, columns = [], includeProjectInfo = false, orgUid = null) {
    // V2 only supports SQLite for FTS5
    const dialect = sequelizeV2.getDialect();
    if (dialect === 'sqlite') {
      return UnitV2.findAllSqliteFts(searchStr, pagination, columns, includeProjectInfo, orgUid);
    }

    // For non-SQLite databases, return empty results
    loggerV2.warn('[v2]: FTS5 search is only supported for SQLite databases');
    return {
      count: 0,
      rows: [],
    };
  }

  /**
   * SQLite FTS5 search implementation with BM25 ranking and UNION support
   * @param {string} searchStr - Search query string
   * @param {Object} pagination - Pagination object with offset and limit
   * @param {Array} columns - Optional array of columns to select
   * @param {boolean} includeProjectInfo - Whether to include project info in search
   * @param {string} orgUid - Optional organization UID for filtering
   * @returns {Promise<Object>} - Object with count and rows
   */
  static async findAllSqliteFts(searchStr, pagination, columns = [], includeProjectInfo = false, orgUid = null) {
    try {
      // Validate columns parameter is an array to prevent type confusion attacks
      if (!Array.isArray(columns)) {
        throw new Error('columns parameter must be an array');
      }

      loggerV2.info('[v2]: UnitV2.findAllSqliteFts called', {
        searchStr,
        pagination,
        columns,
        includeProjectInfo,
        orgUid,
      });

      const { offset, limit } = pagination;

      // Sanitize search query
      const sanitizedSearch = sanitizeSqliteFtsQuery(searchStr);
      loggerV2.info('[v2]: Search string sanitized', { searchStr, sanitizedSearch });

      // Handle empty or invalid search strings
      if (!sanitizedSearch || sanitizedSearch === '*') {
        // * isn't a valid matcher on its own, return empty set
        loggerV2.info('[v2]: Empty or invalid search string, returning empty results');
        return {
          count: 0,
          rows: [],
        };
      }

      // Remove leading '+' if present (legacy V1 behavior)
      let finalSearch = sanitizedSearch;
      if (finalSearch.startsWith('+')) {
        finalSearch = finalSearch.replace('+', '');
      }

      // For FTS5, wrap search strings containing hyphens in double quotes to prevent
      // SQLite from misinterpreting hyphens as operators or column names
      // Only wrap if the string contains hyphens and isn't already quoted
      if (finalSearch && finalSearch.includes('-') && !finalSearch.startsWith('"') && !finalSearch.endsWith('"')) {
        // Escape any existing double quotes in the search string
        const escapedSearch = finalSearch.replace(/"/g, '""');
        finalSearch = `"${escapedSearch}"`;
      }
      loggerV2.info('[v2]: Final search string prepared', { finalSearch });

      // Build field selection
      // Always include org_uid when filtering by orgUid, or when columns are empty (for basic queries)
      let fields = 'cad_trust_unit_id';
      if (orgUid) {
        fields += ', org_uid';
      }
      if (columns.length > 0) {
        // Whitelist of valid column names (camelCase) and their snake_case mappings
        // This prevents SQL injection by only allowing predefined column names
        const columnMap = {
          cadTrustUnitId: 'cad_trust_unit_id',
          orgUid: 'org_uid',
          unitSerialId: 'unit_serial_id',
          unitStartBlock: 'unit_start_block',
          unitEndBlock: 'unit_end_block',
          unitCount: 'unit_count',
          unitType: 'unit_type',
          unitVintageYear: 'unit_vintage_year',
          unitStatus: 'unit_status',
          unitStatusReason: 'unit_status_reason',
          unitStatusDate: 'unit_status_date',
          unitRetirementDetail: 'unit_retirement_detail',
          unitRetirementBeneficiary: 'unit_retirement_beneficiary',
          unitRetirementBeneficiaryId: 'unit_retirement_beneficiary_id',
          unitLink: 'unit_link',
          unitMetric: 'unit_metric',
          unitCurrentOwner: 'unit_current_owner',
          unitItmosReferenceId: 'unit_itmos_reference_id',
          cadTrustIssuanceId: 'cad_trust_issuance_id',
        };

        // Strict whitelist validation - only allow columns in the map
        // This prevents SQL injection by rejecting any non-whitelisted column names
        const validColumns = columns
          .filter((col) => {
            // Type check: column name must be a string
            if (typeof col !== 'string') {
              return false;
            }
            // Only allow columns that exist in the whitelist
            return columnMap.hasOwnProperty(col);
          })
          .map((col) => columnMap[col]); // Map to snake_case

        // If no valid columns after filtering, use default
        if (validColumns.length === 0) {
          fields = 'cad_trust_unit_id';
        } else {
          fields = validColumns.join(', ');
        }

        // Ensure org_uid is included if filtering by orgUid
        if (orgUid && !fields.includes('org_uid')) {
          fields += ', org_uid';
        }
      } else if (orgUid && !fields.includes('org_uid')) {
        // If no columns specified but filtering by orgUid, ensure org_uid is included
        fields += ', org_uid';
      }

      // Build WHERE clause for orgUid filter
      let orgUidFilter = '';
      const replacements = {};
      if (orgUid) {
        // Validate orgUid is a string to prevent type confusion attacks
        if (typeof orgUid !== 'string') {
          throw new Error('orgUid parameter must be a string');
        }

        // Limit orgUid length to prevent DoS attacks
        if (orgUid.length > 100) {
          throw new Error('orgUid parameter exceeds maximum length of 100');
        }

        orgUidFilter = ' AND units_v2_fts.org_uid = :orgUid';
        replacements.orgUid = orgUid;
      }

      let sql;
      let countSql;

      if (includeProjectInfo) {
        // UNION query with project info search
        // Note: V2 uses snake_case table names and field names
        sql = `
          SELECT ${fields}, bm25(units_v2_fts) as relevance
          FROM units_v2_fts
          WHERE units_v2_fts MATCH :search1${orgUidFilter}
          UNION
          SELECT ${fields}, bm25(units_v2_fts) as relevance
          FROM units_v2_fts
          WHERE units_v2_fts MATCH :search3${orgUidFilter}
          UNION
        SELECT ${fields}, bm25(units_v2_fts) as relevance
        FROM units_v2_fts
        INNER JOIN issuance ON units_v2_fts.cad_trust_issuance_id = issuance.cad_trust_issuance_id
        INNER JOIN verification ON issuance.cad_trust_verification_id = verification.cad_trust_verification_id
        INNER JOIN projects_v2_fts ON verification.cad_trust_project_id = projects_v2_fts.cad_trust_project_id
        WHERE projects_v2_fts MATCH :search2${orgUidFilter ? ' AND units_v2_fts.org_uid = :orgUid' : ''}
        `;

        // Count query - use subquery to handle UNION deduplication
        countSql = `
          SELECT COUNT(*) as count FROM (
            SELECT cad_trust_unit_id
            FROM units_v2_fts
            WHERE units_v2_fts MATCH :search1${orgUidFilter}
            UNION
            SELECT cad_trust_unit_id
            FROM units_v2_fts
            WHERE units_v2_fts MATCH :search3${orgUidFilter}
            UNION
          SELECT units_v2_fts.cad_trust_unit_id
          FROM units_v2_fts
          INNER JOIN issuance ON units_v2_fts.cad_trust_issuance_id = issuance.cad_trust_issuance_id
          INNER JOIN verification ON issuance.cad_trust_verification_id = verification.cad_trust_verification_id
          INNER JOIN projects_v2_fts ON verification.cad_trust_project_id = projects_v2_fts.cad_trust_project_id
          WHERE projects_v2_fts MATCH :search2${orgUidFilter ? ' AND units_v2_fts.org_uid = :orgUid' : ''}
          )
        `;

        replacements.search1 = finalSearch;
        replacements.search2 = finalSearch;
        replacements.search3 = `0x${finalSearch}`; // For assetId search
      } else {
        // Standard UNION query (for assetId search with 0x prefix)
        sql = `
          SELECT ${fields}, bm25(units_v2_fts) as relevance
          FROM units_v2_fts
          WHERE units_v2_fts MATCH :search${orgUidFilter}
          UNION
          SELECT ${fields}, bm25(units_v2_fts) as relevance
          FROM units_v2_fts
          WHERE units_v2_fts MATCH :search2${orgUidFilter}
        `;

        // Count query - use subquery to handle UNION deduplication
        countSql = `
          SELECT COUNT(*) as count FROM (
            SELECT cad_trust_unit_id
            FROM units_v2_fts
            WHERE units_v2_fts MATCH :search${orgUidFilter ? orgUidFilter : ''}
            UNION
            SELECT cad_trust_unit_id
            FROM units_v2_fts
            WHERE units_v2_fts MATCH :search2${orgUidFilter ? orgUidFilter : ''}
          )
        `;

        replacements.search = finalSearch;
        replacements.search2 = `0x${finalSearch}`; // For assetId search
      }

      loggerV2.info('[v2]: FTS query prepared', {
        includeProjectInfo,
        sql: sql.substring(0, 200) + '...',
        countSql: countSql.substring(0, 200) + '...',
        replacements,
        fields,
        orgUidFilter,
      });

      // Check if FTS table exists and has data
      try {
        const tableCheck = await sequelizeV2.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='units_v2_fts'",
          { type: Sequelize.QueryTypes.SELECT },
        );
        loggerV2.info('[v2]: FTS table check', { tableExists: tableCheck.length > 0 });

        if (tableCheck.length > 0) {
          const rowCount = await sequelizeV2.query(
            'SELECT COUNT(*) as count FROM units_v2_fts',
            { type: Sequelize.QueryTypes.SELECT },
          );
          loggerV2.info('[v2]: FTS table row count', { count: rowCount[0]?.count || 0 });

          // Test a simple FTS query to verify the table works
          try {
            const testQuery = 'SELECT cad_trust_unit_id FROM units_v2_fts WHERE units_v2_fts MATCH :testSearch LIMIT 1';
            const testResult = await sequelizeV2.query(testQuery, {
              replacements: { testSearch: finalSearch },
              type: Sequelize.QueryTypes.SELECT,
            });
            loggerV2.info('[v2]: Simple FTS test query succeeded', { resultCount: testResult.length });
          } catch (testError) {
            loggerV2.error('[v2]: Simple FTS test query failed', {
              error: testError.message,
              errorStack: testError.stack,
              testSearch: finalSearch,
            });
          }
        }
      } catch (checkError) {
        loggerV2.warn('[v2]: Error checking FTS table', { error: checkError.message });
      }

      // Execute count query
      // Add error handling to debug SQL issues
      let countResult;
      try {
        loggerV2.info('[v2]: Executing FTS count query', {
          countSql: countSql.substring(0, 500) + '...',
          replacementKeys: Object.keys(replacements),
        });

        countResult = await sequelizeV2.query(countSql, {
          replacements,
          type: Sequelize.QueryTypes.SELECT,
        });

        loggerV2.info('[v2]: FTS count query succeeded', { count: countResult[0]?.count || 0 });
      } catch (error) {
        loggerV2.error('[v2]: FTS count query failed', {
          error: error.message,
          errorStack: error.stack,
          sql: countSql.substring(0, 500) + '...',
          replacementKeys: Object.keys(replacements),
          searchStr: searchStr?.substring(0, 100), // Log truncated search string for debugging
        });
        throw error;
      }

      const count = countResult[0]?.count || 0;

      // Validate and sanitize limit and offset to prevent SQL injection
      // Ensure they are integers and within reasonable bounds
      let safeLimit = limit;
      let safeOffset = offset;

      if (limit !== undefined) {
        safeLimit = parseInt(limit, 10);
        if (isNaN(safeLimit) || safeLimit < 0 || safeLimit > 10000) {
          safeLimit = 100; // Default safe limit
          loggerV2.warn('[v2]: Invalid limit value, using default', { providedLimit: limit, safeLimit });
        }
      }

      if (offset !== undefined) {
        safeOffset = parseInt(offset, 10);
        if (isNaN(safeOffset) || safeOffset < 0 || safeOffset > 1000000) {
          safeOffset = 0; // Default safe offset
          loggerV2.warn('[v2]: Invalid offset value, using default', { providedOffset: offset, safeOffset });
        }
      }

      // Add ordering and pagination to main query
      // Use subquery to properly order UNION results by BM25 relevance
      if (safeLimit !== undefined && safeOffset !== undefined) {
        sql = `
          SELECT * FROM (
            ${sql}
          ) ORDER BY relevance ASC LIMIT :limit OFFSET :offset
        `;
        replacements.limit = safeLimit;
        replacements.offset = safeOffset;
      } else {
        sql = `
          SELECT * FROM (
            ${sql}
          ) ORDER BY relevance ASC
        `;
      }

      loggerV2.info('[v2]: Executing FTS main query', {
        sql: sql.substring(0, 300) + '...',
        replacementKeys: Object.keys(replacements),
      });
      const rows = await sequelizeV2.query(sql, {
        replacements,
        type: Sequelize.QueryTypes.SELECT,
      });
      loggerV2.info('[v2]: FTS main query succeeded', { rowCount: rows.length });

      return {
        count,
        rows,
      };
    } catch (error) {
      // Check if error is due to missing FTS table
      if (error.message && error.message.includes('no such table: units_v2_fts')) {
        loggerV2.error('[v2]: FTS table missing, attempting rebuild', { error: error.message });
        try {
          await UnitV2.rebuildFtsTable();
          // Retry query after rebuild
          return UnitV2.findAllSqliteFts(searchStr, pagination, columns, includeProjectInfo, orgUid);
        } catch (rebuildError) {
          loggerV2.error('[v2]: Failed to rebuild FTS table', { error: rebuildError.message });
          throw rebuildError;
        }
      }
      throw error;
    }
  }


  /**
   * Rebuild FTS5 table - useful for recovery from corruption or sync issues
   * @returns {Promise<void>}
   */
  static async rebuildFtsTable() {
    const dialect = sequelizeV2.getDialect();
    if (dialect !== 'sqlite') {
      loggerV2.warn('[v2]: FTS5 rebuild is only supported for SQLite databases');
      return;
    }

    try {
      // Delete all existing FTS data
      await sequelizeV2.query('DELETE FROM units_v2_fts');

      // Re-populate from main table
      await sequelizeV2.query(`
        INSERT INTO units_v2_fts SELECT
          cad_trust_unit_id,
          org_uid,
          unit_serial_id,
          unit_start_block,
          unit_end_block,
          unit_count,
          unit_type,
          unit_vintage_year,
          unit_status,
          unit_status_reason,
          unit_status_date,
          unit_retirement_detail,
          unit_retirement_beneficiary,
          unit_retirement_beneficiary_id,
          unit_link,
          unit_metric,
          unit_current_owner,
          unit_itmos_reference_id,
          marketplace,
          marketplace_link,
          marketplace_identifier,
          cad_trust_issuance_id
        FROM unit
      `);

      loggerV2.info('[v2]: Units FTS5 table rebuilt successfully');
    } catch (error) {
      loggerV2.error('[v2]: Error rebuilding units FTS5 table', { error: error.message });
      throw error;
    }
  }
}

UnitV2.init(
  {
    cadTrustUnitId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_unit_id',
    },
    orgUid: {
      type: Sequelize.STRING(64),
      allowNull: false,
      field: 'org_uid',
      comment: 'Organization UID - identifies which organization owns this unit. Automatically set from home organization.',
    },
    unitSerialId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_serial_id',
    },
    unitStartBlock: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_start_block',
    },
    unitEndBlock: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_end_block',
    },
    unitCount: {
      type: Sequelize.DECIMAL,
      allowNull: true,
      field: 'unit_count',
    },
    unitType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_type',
    },
    unitVintageYear: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'unit_vintage_year',
    },
    unitStatus: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_status',
    },
    unitStatusReason: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_status_reason',
    },
    unitStatusDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'unit_status_date',
    },
    unitRetirementDetail: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_retirement_detail',
    },
    unitRetirementBeneficiary: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_retirement_beneficiary',
    },
    unitRetirementBeneficiaryId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_retirement_beneficiary_id',
    },
    unitLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_link',
    },
    unitMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_metric',
    },
    unitCurrentOwner: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_current_owner',
    },
    unitItmosReferenceId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_itmos_reference_id',
    },
    marketplace: {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: 'marketplace',
      comment: 'Name of the marketplace where the unit is listed'
    },
    marketplaceLink: {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: 'marketplace_link',
      comment: 'URL link to the unit listing on the marketplace'
    },
    marketplaceIdentifier: {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: 'marketplace_identifier',
      comment: 'Unique identifier for the unit on the marketplace'
    },
    cadTrustIssuanceId: {
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_issuance_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'UnitV2',
    tableName: 'unit',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { UnitV2 };
