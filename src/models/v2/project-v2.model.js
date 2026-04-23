'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import * as rxjs from 'rxjs';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { ProjectV2Mirror } from './project-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
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
import { ProgramV2 } from './program-v2.model.js';
import { getDeletedItems } from '../../utils/model-utils.js';
import { keyValueToChangeList } from '../../utils/datalayer-utils.js';
import { LocationV2 } from './location-v2.model.js';
import { EstimationV2 } from './estimation-v2.model.js';
import { RatingV2 } from './rating-v2.model.js';
import { CoBenefitV2 } from './co-benefit-v2.model.js';
import OrganizationsV2 from './organizations-v2.model.js';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import csv from 'csvtojson';

import { loggerV2 } from '../../config/logger.js';
import { sanitizeSqliteFtsQuery } from '../../utils/v2-fts-utils.js';

class ProjectV2 extends Model {
  static changes = new rxjs.Subject();
  static xlsSheetName = 'projects';

  static associate(models) {
    // Project belongs to Program
    ProjectV2.belongsTo(models.ProgramV2, {
      foreignKey: 'cadTrustProgramId',
      as: 'program',
    });

    // Project has many Locations
    ProjectV2.hasMany(models.LocationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'locations',
    });

    // Project has many Estimations
    ProjectV2.hasMany(models.EstimationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'estimations',
    });

    // Project has many Ratings
    ProjectV2.hasMany(models.RatingV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'ratings',
    });

    // Project has many CoBenefits
    ProjectV2.hasMany(models.CoBenefitV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'coBenefits',
    });

    ProjectV2.hasMany(models.ValidationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'validations',
    });

    ProjectV2.hasMany(models.VerificationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'verifications',
    });

    ProjectV2.hasMany(models.ProjectMethodologyV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'projectMethodologies',
    });

    ProjectV2.hasMany(models.StakeholderProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'stakeholderProjects',
    });
  }

  /**
   * Returns associated models for ProjectV2
   * Used by getDeletedItems to identify child records
   * @returns {Array} Array of associated model objects
   */
  static getAssociatedModels = () => [
    { model: LocationV2, pluralize: true },
    { model: EstimationV2, pluralize: true },
    { model: RatingV2, pluralize: true },
    { model: CoBenefitV2, pluralize: true },
  ];

  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectV2Mirror.create(values, mirrorOptions);
    });

    const createResult = await super.create(values, options);
    const { org_uid } = values;
    ProjectV2.changes.next(['projects', org_uid]);

    return createResult;
  }

  static async upsert(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectV2Mirror.upsert(values, mirrorOptions);
    });

    const upsertResult = await super.upsert(values, options);
    const { org_uid } = values;
    ProjectV2.changes.next(['projects', org_uid]);

    return upsertResult;
  }

  static async destroy(options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectV2Mirror.destroy(mirrorOptions);
    });

    ProjectV2.changes.next(['projects']);
    const result = await super.destroy(options);

    return result;
  }

  /**
   * Generates changelist from staged data for ProjectV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with project and child table changes
   */
  static async generateChangeListFromStagedData(
    stagedData,
    comment,
    author,
    registryId,
    isUpdateComment,
    isUpdateAuthor,
  ) {
    // PERFORMANCE: Early exit if no staged records for this model
    const hasStagedData = stagedData.some(
      (record) => record.table === 'project',
    );
    if (!hasStagedData) {
      return {
        project: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'project');

    const primaryKeyMap = {
      project: 'cad_trust_project_id',
    };

    // PERFORMANCE: Only call getDeletedItems() if UPDATE records exist
    const deletedRecords =
      updateRecords.length > 0
        ? await getDeletedItems(
            updateRecords,
            primaryKeyMap,
            ProjectV2,
            'project',
          )
        : [];

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: ProjectV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: ProjectV2,
            toStructuredCsv: true,
          })
        : null;

    const deleteXslsSheets =
      deletedRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: deletedRecords,
            model: ProjectV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "ProjectV2") to table name (e.g., "project")
    // This is needed because createXlsFromSequelizeResults uses model.name as the key,
    // but transformFullXslsToChangeList expects keys matching primaryKeyMap
    const mapSheetNames = (xslsSheets, modelName, tableName) => {
      if (!xslsSheets || !xslsSheets[modelName]) {
        return xslsSheets;
      }
      const mapped = { ...xslsSheets };
      mapped[tableName] = mapped[modelName];
      delete mapped[modelName];
      return mapped;
    };

    // Convert Excel to changelist (only if Excel sheets were created)
    // Pass V2 model map for checking existing records
    const modelMap = {
      project: ProjectV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, ProjectV2.name, 'project'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, ProjectV2.name, 'project'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const deletedAssociationsChangeList = deleteXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(deleteXslsSheets, ProjectV2.name, 'project'),
          'delete',
          primaryKeyMap,
          modelMap,
        )
      : {};

    // PERFORMANCE: Use passed-in metadata instead of fetching
    // Generate comment and author changelist (only from first model that processes it)
    const commentChangeList = keyValueToChangeList(
      'comment',
      `{"comment": "${comment}"}`,
      isUpdateComment,
    );

    const authorChangeList = keyValueToChangeList(
      'author',
      `{"author": "${author}"}`,
      isUpdateAuthor,
    );

    return {
      project: [
        ..._.get(insertChangeList, 'project', []),
        ..._.get(updateChangeList, 'project', []),
        ...deleteChangeList,
      ],
      comment: commentChangeList,
      author: authorChangeList,
    };
  }

  /**
   * Transfer a project between organizations
   * Creates a staging record with is_transfer flag set to true
   * @param {string} projectId - The cadTrustProjectId of the project to transfer
   * @param {string} targetOrgUid - The target organization UID (optional, defaults to home org)
   * @returns {Promise<void>}
   * @throws {Error} If project doesn't exist or transfer fails
   */
  static async transfer(projectId, targetOrgUid = null) {
    // Find the project with all associations
    // Use the actual association names from the model
    const project = await ProjectV2.findByPk(projectId, {
      include: [
        { model: LocationV2, as: 'locations' },
        { model: EstimationV2, as: 'estimations' },
        { model: RatingV2, as: 'ratings' },
        { model: CoBenefitV2, as: 'coBenefits' },
      ],
    });

    if (!project) {
      throw new Error(
        `Project with cadTrustProjectId ${projectId} does not exist`,
      );
    }

    // Get home org (target org for transfer)
    const homeOrg = await OrganizationsV2.getHomeOrg();
    if (!homeOrg) {
      throw new Error('No home organization found');
    }

    // Convert project to plain object and prepare for staging
    const projectData = project.toJSON();

    // Create staging record with is_transfer flag
    await StagingV2.create({
      uuid: projectId,
      action: 'UPDATE',
      table: 'project',
      data: JSON.stringify([projectData]),
      committed: true, // Transfer records are marked as committed immediately
      failed_commit: false,
      is_transfer: true,
    });

    loggerV2.info(`[v2]: Project ${projectId} staged for transfer`);
  }

  /**
   * Update projects from XLSX file
   * Parses XLSX file and stages updates using V2-specific utilities
   * @param {Buffer} fileBuffer - XLSX file buffer
   * @returns {Promise<void>}
   * @throws {Error} If file parsing or staging fails
   */
  static async updateFromXLS(fileBuffer) {
    try {
      const parsedData = parseV2Xlsx(fileBuffer, ProjectV2);
      await stageV2XlsRecords(parsedData, ProjectV2);
      loggerV2.info('[v2]: Projects updated from XLSX file');
    } catch (error) {
      loggerV2.error('[v2]: Error updating projects from XLSX:', error);
      throw new Error(`Failed to update projects from XLSX: ${error.message}`);
    }
  }

  /**
   * Batch upload projects from CSV file.
   *
   * Collects all CSV rows synchronously, then processes each row sequentially
   * inside a transaction.  For each row the pipeline is:
   *   1. Normalize snake_case headers → camelCase attribute names
   *   2. Parse array fields (projectType / projectSector)
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

    await sequelizeV2.transaction(async (transaction) => {
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = i + 2; // +2: 1-indexed + header row
        try {
          let row = normalizeCsvHeaders(rawRows[i], ProjectV2);

          ProjectV2.parseProjectArrayFields(row);

          const projectId = row.cadTrustProjectId;
          let action;
          let mergedRecord;

          let pendingRows = [];
          if (projectId) {
            const existing = await ProjectV2.findByPk(projectId);
            const mergeResult = await buildPendingCsvMergeBase(
              ProjectV2,
              projectId,
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
                error: `Cannot update project ${projectId}: it already has a pending staged delete`,
              });
              continue;
            }
            if (hasMultiRecordPendingRow) {
              errors.push({
                row: rowNum,
                error: `Cannot update project ${projectId}: it already has a complex pending staged update`,
              });
              continue;
            }
            if (!existing && Object.keys(mergedBase).length === 0) {
              errors.push({ row: rowNum, error: `Project with cadTrustProjectId ${projectId} does not exist` });
              continue;
            }
            if (mergedBase.orgUid !== orgUid) {
              errors.push({ row: rowNum, error: `Cannot update project ${projectId}: belongs to a different organization` });
              continue;
            }
            action = existing ? 'UPDATE' : 'INSERT';
            mergedRecord = { ...mergedBase, ...row };
          } else {
            row.cadTrustProjectId = uuidv4();
            action = 'INSERT';
            mergedRecord = { ...row };
          }

          // Required-field validation for INSERT rows
          if (action === 'INSERT') {
            const missing = validateRequiredFields(mergedRecord, ProjectV2);
            if (missing.length > 0) {
              errors.push({ row: rowNum, error: `Missing required field(s): ${missing.join(', ')}` });
              continue;
            }
          }

          // FK existence check for cadTrustProgramId
          if (mergedRecord.cadTrustProgramId) {
            try {
              await assertRecordExistanceOrStaged(
                ProgramV2,
                mergedRecord.cadTrustProgramId,
                `cadTrustProgramId '${mergedRecord.cadTrustProgramId}' does not exist`,
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

          const dbRecord = toDbFieldNames(mergedRecord, ProjectV2);
          const cleaned = stripUnknownDbFields(dbRecord, ProjectV2, loggerV2);

          cleaned.org_uid = orgUid;

          await stageConsolidatedCsvRecord(
            ProjectV2,
            mergedRecord.cadTrustProjectId,
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
   * Parse projectType and projectSector from CSV string representations
   * into arrays.  These are JSON array columns on the project table, not
   * child entities — they belong in the flat CSV row.
   * @private
   */
  static parseProjectArrayFields(project) {
    if (typeof project !== 'object') return;

    const arrayFields = ['projectType', 'projectSector'];
    arrayFields.forEach((key) => {
      if (project[key] !== undefined && project[key] !== null) {
        if (typeof project[key] === 'string') {
          const trimmedValue = project[key].trim();
          if (trimmedValue.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmedValue);
              if (Array.isArray(parsed)) {
                project[key] = parsed;
                return;
              }
            } catch {
              // Not valid JSON, continue
            }
          }
          if (trimmedValue.includes('|')) {
            project[key] = trimmedValue.split('|').map(v => v.trim()).filter(v => v);
          } else if (trimmedValue) {
            project[key] = [trimmedValue];
          } else {
            project[key] = null;
          }
        } else if (!Array.isArray(project[key])) {
          project[key] = [project[key]];
        }
      }
    });
  }

  /**
   * FTS search wrapper - detects dialect and calls appropriate method
   * @param {string} searchStr - Search query string
   * @param {Object} pagination - Pagination object with offset and limit
   * @param {Array} columns - Optional array of columns to select
   * @param {string} orgUid - Optional organization UID for filtering
   * @returns {Promise<Object>} - Object with count and rows
   */
  static async fts(searchStr, pagination, columns = [], orgUid = null) {
    // V2 only supports SQLite for FTS5
    const dialect = sequelizeV2.getDialect();
    if (dialect === 'sqlite') {
      return ProjectV2.findAllSqliteFts(searchStr, pagination, columns, orgUid);
    }

    // For non-SQLite databases, return empty results
    loggerV2.warn('[v2]: FTS5 search is only supported for SQLite databases');
    return {
      count: 0,
      rows: [],
    };
  }

  /**
   * SQLite FTS5 search implementation with BM25 ranking
   * @param {string} searchStr - Search query string
   * @param {Object} pagination - Pagination object with offset and limit
   * @param {Array} columns - Optional array of columns to select
   * @param {string} orgUid - Optional organization UID for filtering
   * @returns {Promise<Object>} - Object with count and rows
   */
  static async findAllSqliteFts(searchStr, pagination, columns = [], orgUid = null) {
    try {
      // Validate columns parameter is an array to prevent type confusion attacks
      if (!Array.isArray(columns)) {
        throw new Error('columns parameter must be an array');
      }

      const { offset, limit } = pagination;

      // Sanitize search query
      const sanitizedSearch = sanitizeSqliteFtsQuery(searchStr);

      // Handle empty or invalid search strings
      if (!sanitizedSearch || sanitizedSearch === '*') {
        // * isn't a valid matcher on its own, return empty set
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

      // Build WHERE clause
      let whereClause = 'projects_v2_fts MATCH :search';
      const replacements = { search: finalSearch };

      // Add orgUid filter if provided
      if (orgUid) {
        // Validate orgUid is a string to prevent type confusion attacks
        if (typeof orgUid !== 'string') {
          throw new Error('orgUid parameter must be a string');
        }

        // Limit orgUid length to prevent DoS attacks
        if (orgUid.length > 100) {
          throw new Error('orgUid parameter exceeds maximum length of 100');
        }

        whereClause += ' AND projects_v2_fts.org_uid = :orgUid';
        replacements.orgUid = orgUid;
      }

      // Build count query using COUNT(*) for efficiency
      const countSql = `
        SELECT COUNT(*) as count
        FROM projects_v2_fts
        WHERE ${whereClause}
      `;

      let countResult;
      try {
        countResult = await sequelizeV2.query(countSql, {
          replacements,
          type: Sequelize.QueryTypes.SELECT,
        });
      } catch (error) {
        loggerV2.error('[v2]: FTS count query failed', {
          error: error.message,
          sql: countSql,
          replacements,
        });
        throw error;
      }

      const count = countResult[0]?.count || 0;

      // Build main query with BM25 ranking
      // Note: Lower BM25 scores = better matches, so ORDER BY ASC
      let fields = 'cad_trust_project_id';
      // Always include org_uid when filtering by orgUid
      if (orgUid) {
        fields += ', org_uid';
      }
      if (columns.length > 0) {
        // Whitelist of valid column names (camelCase) and their snake_case mappings
        // This prevents SQL injection by only allowing predefined column names
        const columnMap = {
          cadTrustProjectId: 'cad_trust_project_id',
          orgUid: 'org_uid',
          projectRegistryName: 'project_registry_name',
          projectId: 'project_id',
          projectCreditingProgram: 'project_crediting_program',
          projectName: 'project_name',
          projectLink: 'project_link',
          projectDescription: 'project_description',
          projectSector: 'project_sector',
          projectType: 'project_type',
          projectSubtype: 'project_subtype',
          projectStatus: 'project_status',
          projectStatusDate: 'project_status_date',
          projectUnitMetric: 'project_unit_metric',
          cadTrustReferenceProjectId: 'cad_trust_reference_project_id',
          cadTrustProgramId: 'cad_trust_program_id',
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
          fields = 'cad_trust_project_id';
        } else {
          // Always include cad_trust_project_id for identification
          const hasProjectId = validColumns.includes('cad_trust_project_id');
          fields = hasProjectId
            ? validColumns.join(', ')
            : `cad_trust_project_id, ${validColumns.join(', ')}`;
        }

        // Ensure org_uid is included if filtering by orgUid and not already in columns
        if (orgUid && !fields.includes('org_uid')) {
          fields += ', org_uid';
        }
      }

      let sql = `
        SELECT ${fields}, bm25(projects_v2_fts) as relevance
        FROM projects_v2_fts
        WHERE ${whereClause}
      `;

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

      // Add ordering and pagination
      if (safeLimit !== undefined && safeOffset !== undefined) {
        sql += ` ORDER BY bm25(projects_v2_fts) ASC LIMIT :limit OFFSET :offset`;
        replacements.limit = safeLimit;
        replacements.offset = safeOffset;
      } else {
        sql += ` ORDER BY bm25(projects_v2_fts) ASC`;
      }

      const rows = await sequelizeV2.query(sql, {
        replacements,
        type: Sequelize.QueryTypes.SELECT,
      });

      return {
        count,
        rows,
      };
    } catch (error) {
      // Check if error is due to missing FTS table
      if (error.message && error.message.includes('no such table: projects_v2_fts')) {
        loggerV2.error('[v2]: FTS table missing, attempting rebuild', { error: error.message });
        try {
          await ProjectV2.rebuildFtsTable();
          // Retry query after rebuild
          return ProjectV2.findAllSqliteFts(searchStr, pagination, columns, orgUid);
        } catch (rebuildError) {
          loggerV2.error('[v2]: Failed to rebuild FTS table', { error: rebuildError.message });
          throw rebuildError;
        }
      }
      throw error;
    }
  }

  /**
   * Get project IDs that have tokenized units (units with marketplaceIdentifier set)
   * Returns project IDs that have at least one unit with marketplaceIdentifier not null and not empty
   * @returns {Promise<Array<string>>} Array of cadTrustProjectId values
   */
  static async getTokenizedProjectIds() {
    const sqlQuery = `
      SELECT DISTINCT project.cad_trust_project_id
      FROM project
      INNER JOIN validation ON project.cad_trust_project_id = validation.cad_trust_project_id
      INNER JOIN verification ON validation.cad_trust_validation_id = verification.cad_trust_validation_id
      INNER JOIN issuance ON verification.cad_trust_verification_id = issuance.cad_trust_verification_id
      INNER JOIN unit ON issuance.cad_trust_issuance_id = unit.cad_trust_issuance_id
      WHERE unit.marketplace_identifier IS NOT NULL
        AND unit.marketplace_identifier != '';
    `;
    const results = await sequelizeV2.query(sqlQuery, {
      type: Sequelize.QueryTypes.SELECT,
    });
    return results.map(row => row.cad_trust_project_id);
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
      await sequelizeV2.query('DELETE FROM projects_v2_fts');

      // Re-populate from main table
      await sequelizeV2.query(`
        INSERT INTO projects_v2_fts SELECT
          cad_trust_project_id,
          org_uid,
          project_registry_name,
          project_id,
          project_crediting_program,
          project_name,
          project_link,
          project_description,
          project_sector,
          project_type,
          project_subtype,
          project_status,
          project_status_date,
          project_unit_metric,
          cad_trust_reference_project_id,
          cad_trust_program_id
        FROM project
      `);

      loggerV2.info('[v2]: Projects FTS5 table rebuilt successfully');
    } catch (error) {
      loggerV2.error('[v2]: Error rebuilding projects FTS5 table', { error: error.message });
      throw error;
    }
  }

}

ProjectV2.init(
  {
    cadTrustProjectId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_project_id',
    },
    orgUid: {
      type: Sequelize.STRING(64),
      allowNull: false,
      field: 'org_uid',
      comment: 'Organization UID - identifies which organization owns this project. Automatically set from home organization.',
    },
    projectRegistryName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_registry_name',
    },
    projectId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_id',
    },
    projectCreditingProgram: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_crediting_program',
    },
    projectName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_name',
    },
    projectLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_link',
    },
    projectDescription: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_description',
    },
    projectSector: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_sector',
      // Stored as JSON string in DB, returned as array to API
      get() {
        const rawValue = this.getDataValue('projectSector');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          // If it's not valid JSON, return as single-item array for backwards compatibility
          return [rawValue];
        }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('projectSector', null);
        } else if (Array.isArray(value)) {
          this.setDataValue('projectSector', JSON.stringify(value));
        } else if (typeof value === 'string') {
          // Check if the string is already a valid JSON array
          const trimmedValue = value.trim();
          if (trimmedValue.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmedValue);
              if (Array.isArray(parsed)) {
                // It's already a valid JSON array string, store as-is
                this.setDataValue('projectSector', trimmedValue);
                return;
              }
            } catch {
              // Not valid JSON, fall through to wrap in array
            }
          }
          // Plain string - wrap it in an array
          this.setDataValue('projectSector', JSON.stringify([value]));
        } else {
          // For any other type, wrap in array
          this.setDataValue('projectSector', JSON.stringify([value]));
        }
      },
    },
    projectType: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_type',
      // Stored as JSON string in DB, returned as array to API
      get() {
        const rawValue = this.getDataValue('projectType');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          // If it's not valid JSON, return as single-item array for backwards compatibility
          return [rawValue];
        }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('projectType', null);
        } else if (Array.isArray(value)) {
          this.setDataValue('projectType', JSON.stringify(value));
        } else if (typeof value === 'string') {
          // Check if the string is already a valid JSON array
          const trimmedValue = value.trim();
          if (trimmedValue.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmedValue);
              if (Array.isArray(parsed)) {
                // It's already a valid JSON array string, store as-is
                this.setDataValue('projectType', trimmedValue);
                return;
              }
            } catch {
              // Not valid JSON, fall through to wrap in array
            }
          }
          // Plain string - wrap it in an array
          this.setDataValue('projectType', JSON.stringify([value]));
        } else {
          // For any other type, wrap in array
          this.setDataValue('projectType', JSON.stringify([value]));
        }
      },
    },
    projectSubtype: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_subtype',
    },
    projectStatus: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_status',
    },
    projectStatusDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'project_status_date',
    },
    projectUnitMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_unit_metric',
    },
    cadTrustReferenceProjectId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'cad_trust_reference_project_id',
    },
    cadTrustProgramId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_program_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProjectV2',
    tableName: 'project',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ProjectV2 };
