'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, UnitV2, IssuanceV2, OrganizationsV2, UnitLabelV2 } from '../../models/v2/index.js';

import {
  optionallyPaginatedResponse,
  paginationParams,
  columnsToInclude,
} from '../../utils/helpers';

import { formatModelAssociationName } from '../../utils/model-utils.js';

import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';

import {
  sendXls,
  createXlsFromSequelizeResults,
} from '../../utils/xls.js';

import { logger } from '../../config/logger.js';
import { unitV2Schema } from '../../validations/v2/unit-v2.validations.js';

// Regex patterns for query parsing
const genericFilterRegex = /^(\w+):(.+):(\w+)$/;
const genericSortColumnRegex = /^(\w+):(ASC|DESC)$/i;
const isArrayRegex = /^\[.*\]$/;

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = unitV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustUnitId')) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'cadTrustUnitId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden orgUid field
    if (newRecord.hasOwnProperty('orgUid')) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'orgUid is automatically set from home organization and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(IssuanceV2, newRecord.cadTrustIssuanceId);

    // Get home organization and set orgUid automatically
    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_unit_id: uuidv4(), // Generate UUID for primary key
      org_uid: homeOrg.org_uid, // Automatically set from home organization
      unit_serial_id: newRecord.unitSerialId,
      unit_start_block: newRecord.unitStartBlock,
      unit_end_block: newRecord.unitEndBlock,
      unit_count: newRecord.unitCount,
      unit_type: newRecord.unitType,
      unit_vintage_year: newRecord.unitVintageYear,
      unit_status: newRecord.unitStatus,
      unit_status_reason: newRecord.unitStatusReason,
      unit_status_date: newRecord.unitStatusDate,
      unit_retirement_detail: newRecord.unitRetirementDetail,
      unit_retirement_beneficiary: newRecord.unitRetirementBeneficiary,
      unit_retirement_beneficiary_id: newRecord.unitRetirementBeneficiaryId,
      unit_link: newRecord.unitLink,
      unit_metric: newRecord.unitMetric,
      unit_current_owner: newRecord.unitCurrentOwner,
      unit_itmos_reference_id: newRecord.unitItmosReferenceId,
      cad_trust_issuance_id: newRecord.cadTrustIssuanceId,
      marketplace: newRecord.marketplace,
      marketplace_link: newRecord.marketplaceLink,
      marketplace_identifier: newRecord.marketplaceIdentifier,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'unit',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit staged successfully',
      uuid,
      success: true,
    });
  } catch (err) {
    logger.error('[v2]: Error creating unit:', err);
    res.status(400).json({
      message: 'Error creating new unit',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    let {
      page,
      limit,
      columns,
      xls,
      orgUid,
      filter,
      order,
      search,
      includeProjectInfoInSearch,
      marketplaceIdentifiers,
      hasMarketplaceIdentifier,
      onlyTokenizedUnits,
    } = req.query;

    let where = {};

    // Handle generic filter (e.g., filter=field:value:eq)
    if (filter) {
      const matches = filter.match(genericFilterRegex);
      if (matches) {
        // Check if the value param is an array so we can parse it
        const valueMatches = matches[2].match(isArrayRegex);
        where[matches[1]] = {
          [Sequelize.Op[matches[3]]]: valueMatches
            ? JSON.parse(matches[2])
            : matches[2],
        };
      }
    }

    // Handle orgUid filter (only if not using FTS search, as FTS handles orgUid internally)
    if (orgUid && !search) {
      where.orgUid = orgUid;
    }

    // Handle marketplaceIdentifiers filter
    if (marketplaceIdentifiers) {
      // Parse comma-separated string or array
      const idsArray = Array.isArray(marketplaceIdentifiers)
        ? marketplaceIdentifiers
        : marketplaceIdentifiers.split(',').map(id => id.trim());
      where.marketplaceIdentifier = {
        [Sequelize.Op.in]: idsArray,
      };
    }

    // Handle hasMarketplaceIdentifier filter
    // Convert string 'true'/'false' to boolean if needed
    const hasMarketplaceIdentifierBool = hasMarketplaceIdentifier === 'true' || hasMarketplaceIdentifier === true;
    const hasMarketplaceIdentifierFalse = hasMarketplaceIdentifier === 'false' || hasMarketplaceIdentifier === false;

    if (hasMarketplaceIdentifierBool) {
      where.marketplaceIdentifier = {
        [Sequelize.Op.ne]: null,
      };
    } else if (hasMarketplaceIdentifierFalse) {
      where.marketplaceIdentifier = {
        [Sequelize.Op.eq]: null,
      };
    }

    // Handle onlyTokenizedUnits filter
    // Convert string 'true'/'false' to boolean if needed
    const onlyTokenizedUnitsBool = onlyTokenizedUnits === 'true' || onlyTokenizedUnits === true;
    const onlyTokenizedUnitsFalse = onlyTokenizedUnits === 'false' || onlyTokenizedUnits === false;

    if (onlyTokenizedUnitsBool) {
      where.marketplaceIdentifier = {
        [Sequelize.Op.ne]: null, // Must have marketplace identifier
      };
      where.marketplace = {
        [Sequelize.Op.eq]: 'Tokenized on Chia', // Must be tokenized on Chia
      };
    } else if (onlyTokenizedUnitsFalse) {
      // Non-tokenized: NOT (marketplace='Tokenized on Chia' AND marketplaceIdentifier IS NOT NULL)
      // Use Sequelize.literal for proper SQL NULL handling
      const nonTokenizedCondition = Sequelize.literal(
        "NOT (marketplace = 'Tokenized on Chia' AND marketplace_identifier IS NOT NULL)"
      );

      // Combine with existing conditions if any
      if (Object.keys(where).length > 0) {
        where = {
          [Sequelize.Op.and]: [
            where,
            nonTokenizedCondition,
          ],
        };
      } else {
        where = nonTokenizedCondition;
      }
    }

    // Get associated models for column selection
    const includes = UnitV2.getAssociatedModels();

    // Default columns for UnitV2
    // Note: createdAt and updatedAt are always included automatically by Sequelize timestamps
    const defaultColumns = [
      'cadTrustUnitId',
      'unitSerialId',
      'unitStartBlock',
      'unitEndBlock',
      'unitCount',
      'unitType',
      'unitVintageYear',
      'unitStatus',
      'unitStatusReason',
      'unitStatusDate',
      'unitRetirementDetail',
      'unitRetirementBeneficiary',
      'unitRetirementBeneficiaryId',
      'unitLink',
      'unitMetric',
      'unitCurrentOwner',
      'unitItmosReferenceId',
      'marketplace',
      'marketplaceLink',
      'marketplaceIdentifier',
      'cadTrustIssuanceId',
      'createdAt',
      'updatedAt',
    ];

    // Handle column selection
    let normalizedColumns = undefined;
    if (columns) {
      // Ensure columns is an array
      const columnsArray = Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim());

      // Remove any unsupported columns
      const validColumns = columnsArray.filter((col) =>
        defaultColumns
          .concat(includes.map(formatModelAssociationName))
          .includes(col),
      );

      // If only FK fields have been specified, select just ID
      if (!validColumns.length) {
        normalizedColumns = ['cadTrustUnitId'];
      } else {
        normalizedColumns = validColumns;
      }
    }
    // When no columns specified, normalizedColumns stays undefined - Sequelize will include all fields

    // Handle pagination
    let pagination = paginationParams(page, limit);

    // If XLS export, remove pagination
    if (xls) {
      pagination = { offset: undefined, limit: undefined };
    }

    // Handle FTS search parameter
    if (search) {
      // Get associated models for column selection (needed for FTS)
      const includes = UnitV2.getAssociatedModels();

      // Default columns for UnitV2
      const defaultColumns = [
        'cadTrustUnitId',
        'unitSerialId',
        'unitStartBlock',
        'unitEndBlock',
        'unitCount',
        'unitType',
        'unitVintageYear',
        'unitStatus',
        'unitStatusReason',
        'unitStatusDate',
        'unitRetirementDetail',
        'unitRetirementBeneficiary',
        'unitRetirementBeneficiaryId',
        'unitLink',
        'unitMetric',
        'unitCurrentOwner',
        'unitItmosReferenceId',
        'marketplace',
        'marketplaceLink',
        'marketplaceIdentifier',
        'cadTrustIssuanceId',
        'createdAt',
        'updatedAt',
      ];

      // Handle column selection for FTS (reuse normalizedColumns if available)
      let ftsColumns = normalizedColumns || [];
      if (ftsColumns.length === 0 && columns) {
        const columnsArray = Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim());
        const validColumns = columnsArray.filter((col) =>
          defaultColumns
            .concat(includes.map(formatModelAssociationName))
            .includes(col),
        );
        ftsColumns = validColumns.length > 0 ? validColumns : ['cadTrustUnitId'];
      }

      // Call FTS method (use pagination without XLS override for FTS)
      const ftsPagination = paginationParams(page, limit);
      const ftsResults = await UnitV2.fts(
        search,
        ftsPagination,
        ftsColumns,
        includeProjectInfoInSearch === 'true' || includeProjectInfoInSearch === true,
        orgUid, // Pass orgUid for FTS filtering
      );

      // Extract cadTrustUnitId values from FTS results
      const mappedResults = ftsResults.rows.map((ftsResult) =>
        _.get(ftsResult, 'cad_trust_unit_id') || _.get(ftsResult, 'cadTrustUnitId'),
      );

      // Filter by FTS results
      if (mappedResults.length > 0) {
        // If warehouseUnitId filter already exists (from other filters), intersect with FTS results
        if (where.cadTrustUnitId && where.cadTrustUnitId[Sequelize.Op.in]) {
          const existingIds = where.cadTrustUnitId[Sequelize.Op.in];
          const intersectedIds = existingIds.filter(id => mappedResults.includes(id));
          where.cadTrustUnitId = {
            [Sequelize.Op.in]: intersectedIds.length > 0 ? intersectedIds : ['no-match'],
          };
        } else {
          where.cadTrustUnitId = {
            [Sequelize.Op.in]: mappedResults,
          };
        }
      } else {
        // No FTS results - return empty set
        const response = optionallyPaginatedResponse(
          { count: ftsResults.count, rows: [] },
          page,
          limit,
        );
        return res.json(response);
      }

      // Note: orgUid filtering is handled in FTS query, so don't add it to where clause again
    }

    // Build query with column selection and includes
    // Consistent with other V2 controllers: if no columns specified, don't set attributes
    let queryAttributes = undefined;
    let fixedIncludes = [
      {
        model: IssuanceV2,
        as: 'issuance',
        required: false,
      },
    ];

    if (normalizedColumns) {
      // User requested specific columns - use columnsToInclude helper
      const columnQuery = columnsToInclude(normalizedColumns, includes);
      queryAttributes = columnQuery.attributes;

      // Build includes with correct V2 aliases based on requested columns
      const columnsArray = normalizedColumns;
      if (columnsArray.includes('unitLabels') || columnsArray.includes('UnitLabelV2')) {
        fixedIncludes.push({
          model: UnitLabelV2,
          as: 'unitLabels',
          required: false,
        });
      }
    }

    const query = {
      attributes: queryAttributes, // undefined = include all fields (consistent with other V2 controllers)
      include: fixedIncludes,
      ...pagination,
    };

    // Handle sorting (default to createdAt DESC)
    // Use Sequelize.literal with snake_case column name for consistent behavior
    let resultOrder = [[Sequelize.literal('`UnitV2`.`created_at`'), 'DESC']];

    if (order?.match(genericSortColumnRegex)) {
      const matches = order.match(genericSortColumnRegex);
      const fieldName = matches[1];
      // Map camelCase to snake_case for ordering (consistent with model field mappings)
      const snakeCaseField = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
      resultOrder = [[Sequelize.literal(`\`UnitV2\`.\`${snakeCaseField}\``), matches[2]]];
    }

    // Execute query
    const results = await UnitV2.findAndCountAll({
      distinct: true,
      where: Object.keys(where).length > 0 ? where : undefined,
      order: resultOrder,
      ...query,
    });

    const response = optionallyPaginatedResponse(results, page, limit);

    // Handle XLS export
    if (xls) {
      return sendXls(
        UnitV2.name,
        createXlsFromSequelizeResults({
          rows: response.data || response,
          model: UnitV2,
          toStructuredCsv: false,
        }),
        res,
      );
    }

    res.json(response);
  } catch (err) {
    logger.error('[v2]: Error retrieving units:', err);
    res.status(400).json({
      message: 'Error retrieving units',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await UnitV2.findByPk(id, {
      include: [
        {
          model: IssuanceV2,
          as: 'issuance',
          required: false,
        },
      ],
    });

    if (!record) {
      return res.status(404).json({
        message: 'Unit not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('[v2]: Error retrieving unit:', err);
    res.status(400).json({
      message: 'Error retrieving unit',
      error: err.message,
      success: false,
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await UnitV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Unit not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = unitV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating unit',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating unit',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Check for forbidden orgUid field
    if (updateData.hasOwnProperty('orgUid')) {
      return res.status(400).json({
        message: 'Error updating unit',
        error: 'orgUid is automatically set from home organization and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(IssuanceV2, updateData.cadTrustIssuanceId);

    // Get home organization and set orgUid automatically (for non-transfer updates)
    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error updating unit',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_unit_id: id, // Use UUID string directly
      org_uid: homeOrg.org_uid, // Automatically set from home organization
    };

    if (updateData.unitSerialId !== undefined) dbUpdateData.unit_serial_id = updateData.unitSerialId;
    if (updateData.unitStartBlock !== undefined) dbUpdateData.unit_start_block = updateData.unitStartBlock;
    if (updateData.unitEndBlock !== undefined) dbUpdateData.unit_end_block = updateData.unitEndBlock;
    if (updateData.unitCount !== undefined) dbUpdateData.unit_count = updateData.unitCount;
    if (updateData.unitType !== undefined) dbUpdateData.unit_type = updateData.unitType;
    if (updateData.unitVintageYear !== undefined) dbUpdateData.unit_vintage_year = updateData.unitVintageYear;
    if (updateData.unitStatus !== undefined) dbUpdateData.unit_status = updateData.unitStatus;
    if (updateData.unitStatusReason !== undefined) dbUpdateData.unit_status_reason = updateData.unitStatusReason;
    if (updateData.unitStatusDate !== undefined) dbUpdateData.unit_status_date = updateData.unitStatusDate;
    if (updateData.unitRetirementDetail !== undefined) dbUpdateData.unit_retirement_detail = updateData.unitRetirementDetail;
    if (updateData.unitRetirementBeneficiary !== undefined) dbUpdateData.unit_retirement_beneficiary = updateData.unitRetirementBeneficiary;
    if (updateData.unitRetirementBeneficiaryId !== undefined) dbUpdateData.unit_retirement_beneficiary_id = updateData.unitRetirementBeneficiaryId;
    if (updateData.unitLink !== undefined) dbUpdateData.unit_link = updateData.unitLink;
    if (updateData.unitMetric !== undefined) dbUpdateData.unit_metric = updateData.unitMetric;
    if (updateData.unitCurrentOwner !== undefined) dbUpdateData.unit_current_owner = updateData.unitCurrentOwner;
    if (updateData.unitItmosReferenceId !== undefined) dbUpdateData.unit_itmos_reference_id = updateData.unitItmosReferenceId;
    if (updateData.marketplace !== undefined) dbUpdateData.marketplace = updateData.marketplace;
    if (updateData.marketplaceLink !== undefined) dbUpdateData.marketplace_link = updateData.marketplaceLink;
    if (updateData.marketplaceIdentifier !== undefined) dbUpdateData.marketplace_identifier = updateData.marketplaceIdentifier;
    if (updateData.cadTrustIssuanceId !== undefined) dbUpdateData.cad_trust_issuance_id = updateData.cadTrustIssuanceId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'unit',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit update staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('[v2]: Error updating unit:', err);
    res.status(400).json({
      message: 'Error updating unit',
      error: err.message,
      success: false,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await UnitV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Unit not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'unit',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_unit_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit delete staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('[v2]: Error deleting unit:', err);
    res.status(400).json({
      message: 'Error deleting unit',
      error: err.message,
      success: false,
    });
  }
};

/**
 * Split a unit into multiple units
 * POST /v2/unit/split
 */
export const split = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustUnitId, records } = req.body;

    if (!cadTrustUnitId) {
      return res.status(400).json({
        message: 'Error splitting unit',
        error: 'cadTrustUnitId is required',
        success: false,
      });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        message: 'Error splitting unit',
        error: 'records array is required and must not be empty',
        success: false,
      });
    }

    // Use the model's split method
    await UnitV2.split(cadTrustUnitId, records);

    res.json({
      message: 'Unit split successful',
      success: true,
    });
  } catch (error) {
    logger.error('[v2]: Error splitting unit:', error);
    res.status(400).json({
      message: 'Error splitting unit',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Update units from XLSX file
 * PUT /v2/unit/xlsx
 * Requires file upload via multer
 */
export const updateFromXLS = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    if (!req.file) {
      return res.status(400).json({
        message: 'File Not Received',
        success: false,
      });
    }

    // Use the model's updateFromXLS method
    await UnitV2.updateFromXLS(req.file.buffer);

    res.json({
      message: 'Updates from xlsx added to staging',
      success: true,
    });
  } catch (error) {
    logger.error('[v2]: Error updating units from XLSX:', error);
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Batch upload units from CSV file
 * POST /v2/unit/batch
 * Requires CSV file upload via multer
 */
export const batchUpload = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    if (!req.file) {
      return res.status(400).json({
        message: 'Cannot find the required csv file',
        success: false,
      });
    }

    // Use the model's batchUpload method
    await UnitV2.batchUpload({ data: req.file.buffer });

    res.json({
      message:
        'CSV processing complete, your records have been added to the staging table.',
      success: true,
    });
  } catch (error) {
    logger.error('[v2]: Batch Upload Failed.', error);
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
      success: false,
    });
  }
};
