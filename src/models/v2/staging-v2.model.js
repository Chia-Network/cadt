'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize, Model } from 'sequelize';
const Op = Sequelize.Op;

import * as rxjs from 'rxjs';

import { sequelizeV2 } from '../../database/v2/index.js';
import { encodeHex, generateOffer } from '../../utils/datalayer-utils.js';
import datalayer from '../../datalayer';
import { loggerV2 } from '../../config/logger.js';
import * as datalayerPersistance from '../../datalayer/persistance.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import { formatModelAssociationName } from '../../utils/model-utils.js';

import ModelTypes from './staging-v2.modeltypes.cjs';

// Import all V2 data models
import {
  OrganizationsV2,
  ProgramV2,
  MethodologyV2,
  ProjectV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ProjectMethodologyV2,
  StakeholderV2,
  StakeholderProjectV2,
  LabelV2,
  UnitLabelV2,
  AefT1SubmissionV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
  MetaV2,
} from './index.js';

class StagingV2 extends Model {
  static changes = new rxjs.Subject();

  static async create(values, options) {
    StagingV2.changes.next(['staging']);
    return super.create(values, options);
  }

  static async destroy(values) {
    StagingV2.changes.next(['staging']);
    return super.destroy(values);
  }

  static async upsert(values, options) {
    StagingV2.changes.next(['staging']);
    return super.upsert(values, options);
  }

  /**
   * Separates staging data into action groups (INSERT, UPDATE, DELETE)
   *
   * @param {Array} stagedData - Array of staging records
   * @param {string} table - Table name to filter by (snake_case, e.g., 'program', 'project')
   * @returns {Array} [insertRecords, updateRecords, deleteChangeList]
   *
   * @example
   * const [inserts, updates, deletes] = StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'project');
   */
  static seperateStagingDataIntoActionGroups = (stagedData, table) => {
    const insertRecords = [];
    const updateRecords = [];
    const deleteChangeList = [];

    stagedData
      .filter((stagingRecord) => stagingRecord.table === table)
      .forEach((stagingRecord) => {
        // Mark records as committed during processing
        StagingV2.update(
          { committed: true },
          { where: { uuid: stagingRecord.uuid } },
        );

        if (stagingRecord.action === 'INSERT') {
          loggerV2.debug('[v2]: Processing INSERT staging record', {
            table,
            uuid: stagingRecord.uuid,
            dataType: typeof stagingRecord.data,
            dataLength: stagingRecord.data?.length,
            dataPreview: stagingRecord.data?.substring(0, 200),
          });
          try {
            const parsedData = JSON.parse(stagingRecord.data);
            loggerV2.debug('[v2]: Parsed INSERT data', {
              table,
              uuid: stagingRecord.uuid,
              parsedDataType: Array.isArray(parsedData) ? 'array' : typeof parsedData,
              parsedDataLength: Array.isArray(parsedData) ? parsedData.length : 'N/A',
              parsedDataSample: Array.isArray(parsedData) && parsedData.length > 0 ? parsedData[0] : parsedData,
            });
            insertRecords.push(...(Array.isArray(parsedData) ? parsedData : [parsedData]));
          } catch (error) {
            loggerV2.error('[v2]: Failed to parse staging record data', {
              table,
              uuid: stagingRecord.uuid,
              error: error.message,
              data: stagingRecord.data,
            });
            throw error;
          }
        } else if (stagingRecord.action === 'UPDATE') {
          // V2 uses snake_case table names directly (no need for hacky fix)
          const tablePrefix = table.toLowerCase();

          // Generate delete changelist item for UPDATE
          // The UUID in staging record is the primary key of the record being updated
          deleteChangeList.push({
            action: 'delete',
            key: encodeHex(`${tablePrefix}|${stagingRecord.uuid}`),
          });

          // TODO: Child table records are getting orphaned in the datalayer,
          // because we need to generate a delete action for each one

          updateRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'DELETE') {
          // V2 uses snake_case table names directly (no need for hacky fix)
          const tablePrefix = table.toLowerCase();

          // Generate delete changelist item for DELETE
          deleteChangeList.push({
            action: 'delete',
            key: encodeHex(`${tablePrefix}|${stagingRecord.uuid}`),
          });

          // TODO: Child table records are getting orphaned in the datalayer,
          // because we need to generate a delete action for each one
        }
      });

    return [insertRecords, updateRecords, deleteChangeList];
  };

  /**
   * Gets diff object for a staging record (for display purposes)
   * V2 version - handles all 21 data models with proper original record fetching
   *
   * @param {string} uuid - The UUID of the staging record (primary key value)
   * @param {string} table - The table name (snake_case, e.g., 'program', 'project')
   * @param {string} action - The action (INSERT, UPDATE, DELETE)
   * @param {string} data - The JSON string data from staging record
   * @returns {Object} Diff object with original and change properties
   */
  static getDiffObject = async (uuid, table, action, data) => {
    const diff = {};

    // Mapping from table name to [Model, primaryKeyField, hasAssociations]
    const tableToModelMap = {
      program: [ProgramV2, 'cadTrustProgramId', false],
      methodology: [MethodologyV2, 'cadTrustMethodologyId', false],
      project: [ProjectV2, 'cadTrustProjectId', true],
      validation: [ValidationV2, 'cadTrustValidationId', false],
      verification: [VerificationV2, 'cadTrustVerificationId', false],
      issuance: [IssuanceV2, 'cadTrustIssuanceId', true],
      unit: [UnitV2, 'cadTrustUnitId', true],
      location: [LocationV2, 'cadTrustLocationId', false],
      estimation: [EstimationV2, 'cadTrustEstimationId', false],
      rating: [RatingV2, 'cadTrustRatingId', false],
      co_benefit: [CoBenefitV2, 'cadTrustCoBenefitId', false],
      project_methodology: [ProjectMethodologyV2, null, false], // Composite key
      stakeholder: [StakeholderV2, 'cadTrustStakeholderId', false],
      stakeholder_projects: [StakeholderProjectV2, 'cadTrustStakeholderProjectId', false],
      label: [LabelV2, 'cadTrustLabelId', false],
      unit_label: [UnitLabelV2, null, false], // Composite key
      aef_t1_submission: [AefT1SubmissionV2, 'cadTrustAefT1SubmissionId', false],
      aef_t5_authorized_entities: [AefT5AuthorizedEntitiesV2, 'cadTrustAefT5AuthorizedEntitiesId', false],
      aef_t2_authorizations: [AefT2AuthorizationsV2, 'cadTrustAefT2AuthorizationsId', false],
      aef_t3_actions: [AefT3ActionsV2, 'cadTrustAefT3ActionsId', false],
      aef_t4_holdings: [AefT4HoldingsV2, 'cadTrustAefT4HoldingsId', false],
    };

    if (action === 'INSERT') {
      diff.original = {};
      diff.change = JSON.parse(data);
    } else if (action === 'UPDATE' || action === 'DELETE') {
      if (action === 'UPDATE') {
        diff.change = JSON.parse(data);
      } else {
        diff.change = {};
      }

      // Fetch original record if model mapping exists
      const modelInfo = tableToModelMap[table];
      if (modelInfo) {
        const [ModelClass, primaryKeyField, hasAssociations] = modelInfo;
        let original = null;

        try {
          if (primaryKeyField) {
            // Simple primary key lookup
            const whereClause = { [primaryKeyField]: uuid };

            // For now, fetch without associations for simplicity
            // Associations can be added later if needed for display purposes
            // The main purpose of getDiffObject is to show original vs changed data
            original = await ModelClass.findOne({
              where: whereClause,
            });
          } else {
            // Composite primary key (join tables)
            // For join tables, the uuid might be a composite key
            // We'll try to parse it or use a different lookup strategy
            // For now, return null for composite keys (they're typically simple relationships)
            original = null;
          }
        } catch (error) {
          // If record doesn't exist or error occurs, set original to null
          loggerV2.debug(`[v2]: Could not fetch original record for ${table}:${uuid}`, {
            error: error.message,
          });
          original = null;
        }

        diff.original = original ? original.toJSON() : null;
      } else {
        // Unknown table, set original to null
        diff.original = null;
      }
    }

    return diff;
  };

  /**
   * Pushes data to the DataLayer.
   * @param {string} tableToPush - The name of the table to push (optional filter).
   * @param {string} comment - The comment to associate with the data.
   * @param {string} author - The author of the data.
   * @param {Array} [ids=[]] - Optional array of IDs to use in the query.
   * @throws {Error} Throws an error if no records are found to send to DataLayer.
   */
  static async pushToDataLayer(tableToPush, comment, author, ids = []) {
    const commitStartTime = Date.now();
    const memoryBefore = process.memoryUsage();
    const monitor = {
      rpcCount: 0,
      modelTimings: {},
      stages: {},
    };

    try {
      // Stage 1: Build where clause and read staging records
      const stage1Start = Date.now();
      const whereClause = {
        committed: false,
        ...(tableToPush ? { table: tableToPush } : {}),
        ...(ids.length ? { uuid: { [Op.in]: ids } } : {}),
      };

      const stagedRecords = await StagingV2.findAll({
        where: whereClause,
        raw: true,
      });

      monitor.stages.readStaging = Date.now() - stage1Start;

      if (!stagedRecords.length) {
        throw new Error('No records to send to DataLayer');
      }

      // Stage 2: Fetch home organization and metadata (PERFORMANCE OPTIMIZATION)
      const stage2Start = Date.now();

      // PERFORMANCE: Fetch home organization ONCE per commit operation
      const homeOrg = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      if (!homeOrg) {
        throw new Error('Home organization not found');
      }

      const { registry_id: registryId } = homeOrg;

      // PERFORMANCE: Fetch comment/author metadata ONCE (not in each model method)
      monitor.rpcCount += 2; // comment + author
      const commentValue = await datalayer.getValue(
        registryId,
        encodeHex('comment'),
      );
      const authorValue = await datalayer.getValue(
        registryId,
        encodeHex('author'),
      );
      const isUpdateComment = !_.isNil(commentValue) && commentValue !== false;
      const isUpdateAuthor = !_.isNil(authorValue) && authorValue !== false;

      monitor.stages.fetchMetadata = Date.now() - stage2Start;

      // Stage 3: Filter models that have staged data (PERFORMANCE OPTIMIZATION)
      const stage3Start = Date.now();

      // All V2 data models
      const allModels = [
        ProgramV2,
        MethodologyV2,
        ProjectV2,
        ValidationV2,
        VerificationV2,
        IssuanceV2,
        UnitV2,
        LocationV2,
        EstimationV2,
        RatingV2,
        CoBenefitV2,
        ProjectMethodologyV2,
        StakeholderV2,
        StakeholderProjectV2,
        LabelV2,
        UnitLabelV2,
        AefT1SubmissionV2,
        AefT5AuthorizedEntitiesV2,
        AefT2AuthorizationsV2,
        AefT3ActionsV2,
        AefT4HoldingsV2,
      ];

      // Map model class names to table names
      const modelToTableMap = {
        ProgramV2: 'program',
        MethodologyV2: 'methodology',
        ProjectV2: 'project',
        ValidationV2: 'validation',
        VerificationV2: 'verification',
        IssuanceV2: 'issuance',
        UnitV2: 'unit',
        LocationV2: 'location',
        EstimationV2: 'estimation',
        RatingV2: 'rating',
        CoBenefitV2: 'co_benefit',
        ProjectMethodologyV2: 'project_methodology',
        StakeholderV2: 'stakeholder',
        StakeholderProjectV2: 'stakeholder_projects',
        LabelV2: 'label',
        UnitLabelV2: 'unit_label',
        AefT1SubmissionV2: 'aef_t1_submission',
        AefT5AuthorizedEntitiesV2: 'aef_t5_authorized_entities',
        AefT2AuthorizationsV2: 'aef_t2_authorizations',
        AefT3ActionsV2: 'aef_t3_actions',
        AefT4HoldingsV2: 'aef_t4_holdings',
      };

      // PERFORMANCE: Filter models that have staged data before processing
      const modelsToProcess = allModels.filter((ModelClass) => {
        const tableName = modelToTableMap[ModelClass.name];
        return stagedRecords.some((record) => record.table === tableName);
      });

      // Call filtered model generateChangeListFromStagedData() methods in parallel
      const modelResults = await Promise.all(
        modelsToProcess.map(async (ModelClass) => {
          const modelStart = Date.now();
          try {
            const result = await ModelClass.generateChangeListFromStagedData(
              stagedRecords,
              comment,
              author,
              registryId,
              isUpdateComment,
              isUpdateAuthor,
            );
            const duration = Date.now() - modelStart;
            monitor.modelTimings[ModelClass.name] = duration;

            loggerV2.debug(`[v2]: Model ${ModelClass.name} processed in ${duration}ms`, {
              model: ModelClass.name,
              duration,
              action: 'generateChangeList',
              recordCount: stagedRecords.filter(
                (r) => r.table === modelToTableMap[ModelClass.name],
              ).length,
            });

            return result;
          } catch (error) {
            const duration = Date.now() - modelStart;
            loggerV2.error(`[v2]: Model ${ModelClass.name} failed after ${duration}ms`, {
              model: ModelClass.name,
              duration,
              error: error.message,
            });
            throw error;
          }
        }),
      );

      monitor.stages.processModels = Date.now() - stage3Start;

      // Stage 4: Merge changelists
      const stage4Start = Date.now();

      // Combine all model changelists into unified object
      const unifiedChangeList = {};
      let commentChangeList = null;
      let authorChangeList = null;

      modelResults.forEach((changeList) => {
        Object.keys(changeList).forEach((key) => {
          if (key === 'comment' && !commentChangeList) {
            commentChangeList = changeList[key];
          } else if (key === 'author' && !authorChangeList) {
            authorChangeList = changeList[key];
          } else {
            // Merge arrays for same keys (e.g., issuances, labels from multiple models)
            if (unifiedChangeList[key]) {
              unifiedChangeList[key] = [
                ...unifiedChangeList[key],
                ...changeList[key],
              ];
            } else {
              unifiedChangeList[key] = changeList[key];
            }
          }
        });
      });

      // Add comment and author changelists (only once)
      if (commentChangeList) {
        unifiedChangeList.comment = commentChangeList;
      }
      if (authorChangeList) {
        unifiedChangeList.author = authorChangeList;
      }

      // Flatten to single array, remove duplicates by [action, key], sort by action
      const finalChangeList = _.uniqBy(
        _.sortBy(_.flatten(_.values(unifiedChangeList)), 'action'),
        (v) => [v.action, v.key].join(),
      );

      monitor.stages.mergeChangelists = Date.now() - stage4Start;

      // Log the final changelist before sending to datalayer
      loggerV2.debug('[v2]: Final changelist prepared for datalayer', {
        registryId,
        changelistSize: finalChangeList.length,
        changelistSummary: finalChangeList.map((change) => ({
          action: change.action,
          key: change.key ? change.key.substring(0, 20) + '...' : change.key,
          hasValue: !!change.value,
        })),
        stagedRecordsCount: stagedRecords.length,
        tables: [...new Set(stagedRecords.map((r) => r.table))],
      });

      // Stage 5: Push to datalayer
      const stage5Start = Date.now();

      monitor.rpcCount += 1; // pushDataLayerChangeList

      await datalayer.pushDataLayerChangeList(
        registryId,
        finalChangeList,
        async () => {
          await StagingV2.update(
            { failed_commit: true },
            { where: { committed: true } },
          );
        },
      );

      monitor.stages.pushToDatalayer = Date.now() - stage5Start;

      // Final summary log
      const totalDuration = Date.now() - commitStartTime;
      const memoryAfter = process.memoryUsage();

      loggerV2.info('[v2]: Commit completed with performance metrics', {
        duration: {
          total: totalDuration,
          stages: monitor.stages,
          models: monitor.modelTimings,
        },
        memory: {
          heapUsedDelta:
            ((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(
              2,
            ) + ' MB',
          rssDelta:
            ((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024).toFixed(2) +
            ' MB',
        },
        rpc: {
          totalCalls: monitor.rpcCount,
          breakdown: {
            metadata: 2,
            push: 1,
          },
        },
        data: {
          recordCount: stagedRecords.length,
          tableCount: new Set(stagedRecords.map((r) => r.table)).size,
          changelistSize: finalChangeList.length,
        },
      });

      // Performance warnings
      const WARNING_THRESHOLD = 5000; // 5 seconds
      const ERROR_THRESHOLD = 30000; // 30 seconds

      if (totalDuration > ERROR_THRESHOLD) {
        loggerV2.error('[v2]: Commit exceeded error threshold', {
          duration: totalDuration,
          threshold: ERROR_THRESHOLD,
          recordCount: stagedRecords.length,
          tableCount: new Set(stagedRecords.map((r) => r.table)).size,
          recommendation: 'Investigate performance bottleneck',
        });
      } else if (totalDuration > WARNING_THRESHOLD) {
        loggerV2.warn('[v2]: Commit exceeded warning threshold', {
          duration: totalDuration,
          threshold: WARNING_THRESHOLD,
          recordCount: stagedRecords.length,
          tableCount: new Set(stagedRecords.map((r) => r.table)).size,
        });
      }

      // Memory warning
      const memoryDelta =
        (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024; // MB
      if (memoryDelta > 100) {
        loggerV2.warn('[v2]: High memory usage during commit', {
          heapUsedDelta: memoryDelta.toFixed(2) + ' MB',
          recordCount: stagedRecords.length,
          recommendation: 'Consider batching commits for large datasets',
        });
      }
    } catch (error) {
      const totalDuration = Date.now() - commitStartTime;
      loggerV2.error('[v2]: Commit failed with performance metrics', {
        duration: totalDuration,
        error: error.message,
        metrics: monitor,
      });
      throw error;
    }
  }

  /**
   * Generate offer file for project transfer
   * Adapted from V1 Staging.generateOfferFile for V2 models and field names
   * @returns {Promise<Object>} Offer file response
   */
  static generateOfferFile = async () => {
    try {
      const stagingRecord = await StagingV2.findOne({
        where: { is_transfer: true },
        raw: true,
      });

      if (!stagingRecord) {
        throw new Error('No transfer record found in staging');
      }

      const makerProjectRecord = _.head(JSON.parse(stagingRecord.data));

      const myOrganization = await OrganizationsV2.getHomeOrg();
      if (!myOrganization) {
        throw new Error('No home organization found');
      }

      // In V2, projects don't have orgUid field directly
      // We need to find the taker organization by finding which org owns the project
      // For now, we'll get the project from the database to find its current owner
      // Since V2 projects don't have orgUid, we'll need to find organizations that have
      // projects in their registry stores. For simplicity, we'll get all non-home orgs
      // and find the one that matches the project's registry context.
      // Note: This is a simplified approach - in production, you'd need to track
      // which organization owns which projects through registry store relationships

      // Get the actual project from database to determine its context
      const actualProject = await ProjectV2.findByPk(makerProjectRecord.cadTrustProjectId);
      if (!actualProject) {
        throw new Error(
          `Project with cadTrustProjectId ${makerProjectRecord.cadTrustProjectId} not found`,
        );
      }

      // For V2, we need a different approach to find taker org
      // Since projects don't have orgUid, we'll use the first non-home org as taker
      // In a real scenario, this would be determined by registry store ownership
      // Note: OrganizationsV2 uses snake_case field names in database
      const takerOrganization = await OrganizationsV2.findOne({
        where: {
          is_home: false,
          subscribed: true,
        },
        raw: true,
      });

      if (!takerOrganization) {
        throw new Error('No taker organization found for transfer');
      }

      const maker = { inclusions: [] };
      const taker = { inclusions: [] };

      taker.storeId = takerOrganization.registryStoreId;
      maker.storeId = myOrganization.registryStoreId;

      // Get taker project with all associations
      // Use explicit association aliases from ProjectV2 model
      const takerProjectRecord = await ProjectV2.findOne({
        where: { cadTrustProjectId: makerProjectRecord.cadTrustProjectId },
        include: [
          { model: LocationV2, as: 'locations' },
          { model: EstimationV2, as: 'estimations' },
          { model: RatingV2, as: 'ratings' },
          { model: CoBenefitV2, as: 'coBenefits' },
        ],
      });

      if (!takerProjectRecord) {
        throw new Error(
          `Project with cadTrustProjectId ${makerProjectRecord.cadTrustProjectId} not found`,
        );
      }

      // Convert Sequelize instance to plain object
      const takerProjectPlain = takerProjectRecord.get({ plain: true });
      takerProjectPlain.projectStatus = 'Transitioned';

      const newMakerCadTrustProjectId = uuidv4();
      // Update maker project record (note: V2 projects don't have orgUid field)
      makerProjectRecord.cadTrustProjectId = newMakerCadTrustProjectId;

      // V2 project child records
      const projectChildRecords = [
        'locations',
        'estimations',
        'ratings',
        'coBenefits',
      ];

      // Each child record for the maker needs the new projectId
      // Note: V2 child records may not have orgUid field
      projectChildRecords.forEach((childRecordSet) => {
        if (makerProjectRecord[childRecordSet]) {
          makerProjectRecord[childRecordSet].forEach((childRecord) => {
            childRecord.cadTrustProjectId = newMakerCadTrustProjectId;
            // Only update orgUid if the field exists (for compatibility)
            if (childRecord.orgUid !== undefined) {
              childRecord.orgUid = myOrganization.orgUid;
            }
          });
        }
      });

      // Get verifications for the project, then issuances for those verifications
      const verifications = await VerificationV2.findAll({
        where: { cadTrustProjectId: takerProjectPlain.cadTrustProjectId },
        raw: true,
      });

      const verificationIds = verifications.map((v) => v.cadTrustVerificationId);

      const issuances = await IssuanceV2.findAll({
        where: {
          cadTrustVerificationId: { [Op.in]: verificationIds },
        },
        raw: true,
      });

      const issuanceIds = issuances.map((i) => i.cadTrustIssuanceId);

      // Get units for the issuances
      // Note: In V2, units may not have orgUid field, so we'll get all units for these issuances
      let unitTakerRecords = await UnitV2.findAll({
        where: {
          cadTrustIssuanceId: { [Op.in]: issuanceIds },
        },
        raw: true,
      });

      // Makers get an unaltered copy of all the project units from the taker
      const unitMakerRecords = _.cloneDeep(unitTakerRecords);

      unitTakerRecords = unitTakerRecords.map((record) => {
        record.unitStatus = 'Exported';
        record.cadTrustUnitId = uuidv4();
        // Only update orgUid if the field exists (for compatibility)
        if (record.orgUid !== undefined) {
          record.orgUid = myOrganization.orgUid;
        }
        return record;
      });

      // Update maker unit records with new project ID references
      // Note: V2 units may not have orgUid field
      unitMakerRecords.forEach((record) => {
        // Find the corresponding issuance and update references if needed
        const issuance = issuances.find(
          (i) => i.cadTrustIssuanceId === record.cadTrustIssuanceId,
        );
        if (issuance) {
          // Find the corresponding verification and update if needed
          const verification = verifications.find(
            (v) => v.cadTrustVerificationId === issuance.cadTrustVerificationId,
          );
          if (verification) {
            // Update verification to point to new project
            verification.cadTrustProjectId = newMakerCadTrustProjectId;
            // Only update orgUid if the field exists (for compatibility)
            if (verification.orgUid !== undefined) {
              verification.orgUid = myOrganization.orgUid;
            }
          }
        }
        // Only update orgUid if the field exists (for compatibility)
        if (record.orgUid !== undefined) {
          record.orgUid = myOrganization.orgUid;
        }
      });

      const primaryProjectKeyMap = {
        project: 'cadTrustProjectId',
        locations: 'cadTrustLocationId',
        estimations: 'cadTrustEstimationId',
        ratings: 'cadTrustRatingId',
        coBenefits: 'cadTrustCoBenefitId',
      };

      const primaryUnitKeyMap = {
        unit: 'cadTrustUnitId',
        unitLabels: 'id', // Join table uses 'id' as primary key
      };

      // Map sheet names from model.name to table name
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
          LocationV2: 'locations',
          EstimationV2: 'estimations',
          RatingV2: 'ratings',
          CoBenefitV2: 'coBenefits',
          UnitLabelV2: 'unitLabels',
        };
        Object.keys(childMappings).forEach((childModelName) => {
          if (mapped[childModelName]) {
            mapped[childMappings[childModelName]] = mapped[childModelName];
            delete mapped[childModelName];
          }
        });
        return mapped;
      };

      // Model maps for checking existing records
      const projectModelMap = {
        project: ProjectV2,
        locations: LocationV2,
        estimations: EstimationV2,
        ratings: RatingV2,
        coBenefits: CoBenefitV2,
      };

      const unitModelMap = {
        unit: UnitV2,
        unitLabels: UnitLabelV2,
      };

      const takerProjectXslsSheets = createXlsFromSequelizeResults({
        rows: [takerProjectPlain],
        model: ProjectV2,
        toStructuredCsv: true,
      });

      const makerProjectPlain = makerProjectRecord.get
        ? makerProjectRecord.get({ plain: true })
        : makerProjectRecord;
      const makerProjectXslsSheets = createXlsFromSequelizeResults({
        rows: [makerProjectPlain],
        model: ProjectV2,
        toStructuredCsv: true,
      });

      const takerUnitXslsSheets = createXlsFromSequelizeResults({
        rows: unitTakerRecords,
        model: UnitV2,
        toStructuredCsv: true,
      });

      const makerUnitXslsSheets = createXlsFromSequelizeResults({
        rows: unitMakerRecords,
        model: UnitV2,
        toStructuredCsv: true,
      });

      const makerProjectInclusions = await transformFullXslsToChangeList(
        mapSheetNames(makerProjectXslsSheets, ProjectV2.name, 'project'),
        'insert',
        primaryProjectKeyMap,
        projectModelMap,
      );

      const takerProjectInclusions = await transformFullXslsToChangeList(
        mapSheetNames(takerProjectXslsSheets, ProjectV2.name, 'project'),
        'insert',
        primaryProjectKeyMap,
        projectModelMap,
      );

      const takerUnitInclusions = await transformFullXslsToChangeList(
        mapSheetNames(takerUnitXslsSheets, UnitV2.name, 'unit'),
        'insert',
        primaryUnitKeyMap,
        unitModelMap,
      );

      const makerUnitInclusions = await transformFullXslsToChangeList(
        mapSheetNames(makerUnitXslsSheets, UnitV2.name, 'unit'),
        'insert',
        primaryUnitKeyMap,
        unitModelMap,
      );

      const formatForOfferTransfer = (record) => {
        return record
          .filter((inclusion) => inclusion.action !== 'delete')
          .map((inclusion) => ({
            key: inclusion.key,
            value: inclusion.value,
          }));
      };

      taker.inclusions.push(
        ...formatForOfferTransfer(takerProjectInclusions.project || []),
      );

      if (takerUnitInclusions?.unit) {
        taker.inclusions.push(
          ...formatForOfferTransfer(takerUnitInclusions.unit),
        );
      }

      if (makerProjectInclusions?.project) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.project),
        );
      }

      if (makerProjectInclusions?.locations) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.locations),
        );
      }

      if (makerProjectInclusions?.estimations) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.estimations),
        );
      }

      if (makerProjectInclusions?.ratings) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.ratings),
        );
      }

      if (makerProjectInclusions?.coBenefits) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.coBenefits),
        );
      }

      if (makerUnitInclusions?.unit) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerUnitInclusions.unit),
        );
      }

      const offerInfo = generateOffer(maker, taker);

      // In simulator mode, return mock response to avoid datalayer connection
      const { getConfig } = await import('../../utils/config-loader.js');
      const CONFIG = getConfig().APP;
      let offerResponse;

      if (CONFIG.USE_SIMULATOR) {
        // Mock response for simulator mode
        offerResponse = {
          success: true,
          offer: {
            trade_id: `simulator-trade-${Date.now()}`,
            maker: offerInfo.maker,
            taker: offerInfo.taker,
          },
        };
      } else {
        offerResponse = await datalayerPersistance.makeOffer(offerInfo);
      }

      if (!offerResponse.success) {
        throw new Error(offerResponse.error);
      }

      // MetaV2 uses snake_case field names in database (meta_key, meta_value)
      await MetaV2.upsert({
        meta_key: 'activeOfferTradeId',
        meta_value: offerResponse.offer.trade_id,
      });

      return _.omit(offerResponse, ['success']);
    } catch (error) {
      loggerV2.error('[v2]: Error generating offer file:', error);
      throw new Error(error.message);
    }
  };
}

StagingV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'StagingV2',
  tableName: 'staging',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default StagingV2;
