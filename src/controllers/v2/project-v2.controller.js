'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, ProjectV2, ProgramV2, OrganizationsV2, LocationV2, EstimationV2, RatingV2, CoBenefitV2 } from '../../models/v2/index.js';

import {
  optionallyPaginatedResponse,
  paginationParams,
  columnsToInclude,
} from '../../utils/helpers';

import {
  genericFilterRegex,
  genericSortColumnRegex,
  isArrayRegex,
} from '../../utils/string-utils.js';

import {
  createXlsFromSequelizeResults,
  sendXls,
} from '../../utils/xls.js';

import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
  assertStagingTableIsEmpty,
} from '../../utils/v2-data-assertions.js';

import { loggerV2 } from '../../config/logger.js';
import { projectV2Schema } from '../../validations/v2/project-v2.validations.js';
import { formatModelAssociationName } from '../../utils/model-utils.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = projectV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new project',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustProjectId')) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: 'cadTrustProjectId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden orgUid field
    if (newRecord.hasOwnProperty('orgUid')) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: 'orgUid is automatically set from home organization and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign key if provided
    if (newRecord.cadTrustProgramId) {
      try {
        await assertRecordExistanceOrStaged(
          ProgramV2,
          newRecord.cadTrustProgramId,
          `cadTrustProgramId '${newRecord.cadTrustProgramId}' does not exist. Please create the program first or use a valid cadTrustProgramId`,
        );
      } catch (err) {
        return res.status(400).json({
          message: 'Error creating new project',
          error: err.message,
          success: false,
        });
      }
    }

    // Get home organization and set orgUid automatically
    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustProjectId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_project_id: cadTrustProjectId,
      org_uid: homeOrg.org_uid, // Automatically set from home organization
      project_registry_name: newRecord.projectRegistryName,
      project_id: newRecord.projectId,
      project_crediting_program: newRecord.projectCreditingProgram,
      project_name: newRecord.projectName,
      project_link: newRecord.projectLink,
      project_description: newRecord.projectDescription,
      project_sector: newRecord.projectSector,
      project_type: newRecord.projectType,
      project_subtype: newRecord.projectSubtype,
      project_status: newRecord.projectStatus,
      project_status_date: newRecord.projectStatusDate,
      project_unit_metric: newRecord.projectUnitMetric,
      cad_trust_reference_project_id: newRecord.cadTrustReferenceProjectId,
      cad_trust_program_id: newRecord.cadTrustProgramId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'project',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project staged successfully',
      uuid,
      cadTrustProjectId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating project:', err);
    res.status(400).json({
      message: 'Error creating new project',
      error: err?.message || err?.toString() || 'Unknown error occurred',
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
      projectIds,
      orgUid,
      filter,
      order,
      search,
      onlyMarketplaceProjects,
    } = req.query;

    let where = {};

    // Handle generic filter (e.g., filter=field:value:eq)
    if (filter) {
      // Type check: filter must be a string to prevent type confusion attacks
      if (typeof filter !== 'string') {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: 'Filter parameter must be a string',
          success: false,
        });
      }

      // Limit input length to prevent ReDoS attacks
      if (filter.length > 10000) {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: 'Filter parameter exceeds maximum length',
          success: false,
        });
      }
      const matches = filter.match(genericFilterRegex);
      if (matches) {
        const valueStr = matches[2];
        // Additional length check on extracted value
        if (valueStr.length > 5000) {
          return res.status(400).json({
            message: 'Error retrieving projects',
            error: 'Filter value exceeds maximum length',
            success: false,
          });
        }
        // Check if the value param is an array using safer anchored regex
        const valueMatches = valueStr.match(isArrayRegex);
        where[matches[1]] = {
          [Sequelize.Op[matches[3]]]: valueMatches
            ? JSON.parse(valueStr)
            : valueStr,
        };
      }
    }

    // Handle projectIds filter (array of cadTrustProjectId)
    // Note: Sequelize uses camelCase for model attributes, but we need to check the actual field name
    if (projectIds) {
      // Type check: projectIds must be an array or string to prevent DoS attacks
      let idsArray;
      if (Array.isArray(projectIds)) {
        // Limit array length to prevent DoS attacks
        if (projectIds.length > 10000) {
          return res.status(400).json({
            message: 'Error retrieving projects',
            error: 'projectIds array exceeds maximum length of 10000',
            success: false,
          });
        }
        idsArray = projectIds;
      } else if (typeof projectIds === 'string') {
        idsArray = projectIds.split(',').map(id => id.trim());
        // Limit array length after splitting
        if (idsArray.length > 10000) {
          return res.status(400).json({
            message: 'Error retrieving projects',
            error: 'projectIds exceeds maximum length of 10000',
            success: false,
          });
        }
      } else {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: 'projectIds must be an array or comma-separated string',
          success: false,
        });
      }
      where.cadTrustProjectId = {
        [Sequelize.Op.in]: idsArray,
      };
    }

    // Handle orgUid filter (only if not using FTS search, as FTS handles orgUid internally)
    if (orgUid && !search) {
      where.orgUid = orgUid;
    }

    // Handle onlyMarketplaceProjects filter
    if (onlyMarketplaceProjects) {
      const marketplaceProjectIds = await ProjectV2.getTokenizedProjectIds();
      where.cadTrustProjectId = {
        [Sequelize.Op.in]: marketplaceProjectIds,
      };
    }

    // Get associated models for column selection
    const includes = ProjectV2.getAssociatedModels();

    // Default columns for ProjectV2
    // Note: createdAt and updatedAt are always included automatically by Sequelize timestamps
    // They don't need to be in defaultColumns, but can be requested by users
    const defaultColumns = [
      'cadTrustProjectId',
      'projectRegistryName',
      'projectId',
      'projectCreditingProgram',
      'projectName',
      'projectLink',
      'projectDescription',
      'projectSector',
      'projectType',
      'projectSubtype',
      'projectStatus',
      'projectStatusDate',
      'projectUnitMetric',
      'cadTrustReferenceProjectId',
      'cadTrustProgramId',
      'createdAt',
      'updatedAt',
    ];

    // Handle column selection
    // Note: columnsToInclude expects an array, so we'll normalize columns here
    let normalizedColumns = undefined;
    if (columns) {
      // Ensure columns is an array
      const columnsArray = Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim());

      // Valid association names (parent and child models)
      const validAssociationNames = [
        'program', 'ProgramV2', // Parent association
        'locations', 'LocationV2', // Child associations
        'estimations', 'EstimationV2',
        'ratings', 'RatingV2',
        'coBenefits', 'CoBenefitV2',
      ];

      // Remove any unsupported columns
      const validColumns = columnsArray.filter((col) =>
        defaultColumns
          .concat(includes.map(formatModelAssociationName))
          .concat(validAssociationNames)
          .includes(col),
      );

      // If only FK fields have been specified, select just ID
      if (!validColumns.length) {
        normalizedColumns = ['cadTrustProjectId'];
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
      // Handle column selection for FTS (reuse normalizedColumns if available)
      let ftsColumns = normalizedColumns || [];
      if (ftsColumns.length === 0 && columns) {
        const columnsArray = Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim());
        const validColumns = columnsArray.filter((col) =>
          defaultColumns
            .concat(includes.map(formatModelAssociationName))
            .includes(col),
        );
        ftsColumns = validColumns.length > 0 ? validColumns : [];
      }
      // If still empty, use empty array (will select all default fields)
      if (ftsColumns.length === 0) {
        ftsColumns = [];
      }

      // Call FTS method (use pagination without XLS override for FTS)
      const ftsPagination = paginationParams(page, limit);
      const ftsResults = await ProjectV2.fts(
        search,
        ftsPagination,
        ftsColumns,
        orgUid, // Pass orgUid for FTS filtering
      );

      // Extract cadTrustProjectId values from FTS results
      const mappedResults = ftsResults.rows.map((ftsResult) =>
        _.get(ftsResult, 'cad_trust_project_id') || _.get(ftsResult, 'cadTrustProjectId'),
      );

      // Filter by FTS results
      if (mappedResults.length > 0) {
        // If projectIds filter already exists, intersect with FTS results
        if (where.cadTrustProjectId && where.cadTrustProjectId[Sequelize.Op.in]) {
          const existingIds = where.cadTrustProjectId[Sequelize.Op.in];
          const intersectedIds = existingIds.filter(id => mappedResults.includes(id));
          where.cadTrustProjectId = {
            [Sequelize.Op.in]: intersectedIds.length > 0 ? intersectedIds : ['no-match'],
          };
        } else {
          where.cadTrustProjectId = {
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

    // Build query with column selection and associations
    // Consistent with other V2 controllers: if no columns specified, don't set attributes
    // This lets Sequelize automatically include all fields including timestamps
    let queryAttributes = undefined;
    let queryIncludes = [];

    if (normalizedColumns) {
      // Association names that can be included
      const associationNames = ['program', 'ProgramV2', 'locations', 'LocationV2', 'estimations', 'EstimationV2', 'ratings', 'RatingV2', 'coBenefits', 'CoBenefitV2'];
      const regularColumns = normalizedColumns.filter(col => !associationNames.includes(col));

      // Check if associations are requested
      const requestedAssociations = normalizedColumns.filter(col => associationNames.includes(col));

      // Build include array for requested associations
      if (requestedAssociations.includes('program') || requestedAssociations.includes('ProgramV2')) {
        queryIncludes.push({
          model: ProgramV2,
          as: 'program',
          required: false, // LEFT JOIN
        });
      }
      if (requestedAssociations.includes('locations') || requestedAssociations.includes('LocationV2')) {
        queryIncludes.push({
          model: LocationV2,
          as: 'locations',
          required: false,
        });
      }
      if (requestedAssociations.includes('estimations') || requestedAssociations.includes('EstimationV2')) {
        queryIncludes.push({
          model: EstimationV2,
          as: 'estimations',
          required: false,
        });
      }
      if (requestedAssociations.includes('ratings') || requestedAssociations.includes('RatingV2')) {
        queryIncludes.push({
          model: RatingV2,
          as: 'ratings',
          required: false,
        });
      }
      if (requestedAssociations.includes('coBenefits') || requestedAssociations.includes('CoBenefitV2')) {
        queryIncludes.push({
          model: CoBenefitV2,
          as: 'coBenefits',
          required: false,
        });
      }

      // Use columnsToInclude helper only for regular columns
      if (regularColumns.length > 0) {
        const columnQuery = columnsToInclude(regularColumns, []);
        queryAttributes = columnQuery.attributes;
      }
    }

    const query = {
      attributes: queryAttributes, // undefined = include all fields (consistent with other V2 controllers)
      include: queryIncludes.length > 0 ? queryIncludes : undefined,
      ...pagination,
    };

    // Handle sorting (default to createdAt DESC)
    // Whitelist of valid column names for ordering (camelCase as used in API)
    const validOrderColumns = [
      'cadTrustProjectId',
      'projectRegistryName',
      'projectId',
      'projectCreditingProgram',
      'projectName',
      'projectLink',
      'projectDescription',
      'projectSector',
      'projectType',
      'projectSubtype',
      'projectStatus',
      'projectStatusDate',
      'projectUnitMetric',
      'cadTrustReferenceProjectId',
      'cadTrustProgramId',
      'createdAt',
      'updatedAt',
    ];

    // Note: Sequelize maps camelCase attributes to snake_case for SELECT when underscored: true
    // But ORDER BY needs explicit mapping when attributes are specified
    // Use Sequelize.literal with snake_case column name for consistent behavior
    let resultOrder = [[Sequelize.literal('`ProjectV2`.`created_at`'), 'DESC']];

    if (order) {
      // Type check: order must be a string to prevent type confusion attacks
      if (typeof order !== 'string') {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: 'Order parameter must be a string',
          success: false,
        });
      }

      // Limit input length to prevent ReDoS attacks
      if (order.length > 200) {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: 'Order parameter exceeds maximum length',
          success: false,
        });
      }

      const orderMatch = order.match(genericSortColumnRegex);
      if (!orderMatch) {
        // Reject order parameters that don't match the expected format
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: `Invalid order format: ${order}. Expected format: columnName:ASC or columnName:DESC`,
          success: false,
        });
      }

      const matches = orderMatch;
      const fieldName = matches[1];
      const sortDirection = matches[2].toUpperCase();

      // Validate fieldName against whitelist to prevent SQL injection
      if (!validOrderColumns.includes(fieldName)) {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: `Invalid sort column: ${fieldName}. Valid columns are: ${validOrderColumns.join(', ')}`,
          success: false,
        });
      }

      // Validate sort direction
      if (sortDirection !== 'ASC' && sortDirection !== 'DESC') {
        return res.status(400).json({
          message: 'Error retrieving projects',
          error: `Invalid sort direction: ${sortDirection}. Must be ASC or DESC`,
          success: false,
        });
      }

      // Map camelCase to snake_case for ordering (consistent with model field mappings)
      // Convert camelCase to snake_case: projectName -> project_name, createdAt -> created_at
      // Only alphanumeric and underscore characters are allowed after validation
      const snakeCaseField = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
      // Use Sequelize.literal with properly validated and escaped column name
      resultOrder = [[Sequelize.literal(`\`ProjectV2\`.\`${snakeCaseField}\``), sortDirection]];
    }

    // Execute query
    const results = await ProjectV2.findAndCountAll({
      distinct: true,
      where: Object.keys(where).length > 0 ? where : undefined,
      order: resultOrder,
      ...query,
    });

    const response = optionallyPaginatedResponse(results, page, limit);

    // Handle XLS export
    if (xls) {
      return sendXls(
        'projects',
        createXlsFromSequelizeResults({
          rows: response.data || response,
          model: ProjectV2,
          toStructuredCsv: false,
        }),
        res,
      );
    }

    res.json(response);
  } catch (err) {
    logger.error('[v2]: Error retrieving projects:', err);
    res.status(400).json({
      message: 'Error retrieving projects',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const { columns } = req.query;

    // Handle association includes
    let queryIncludes = [];
    if (columns) {
      const columnsArray = Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim());
      if (columnsArray.includes('program') || columnsArray.includes('ProgramV2')) {
        queryIncludes.push({
          model: ProgramV2,
          as: 'program',
          required: false,
        });
      }
      if (columnsArray.includes('locations') || columnsArray.includes('LocationV2')) {
        queryIncludes.push({
          model: LocationV2,
          as: 'locations',
          required: false,
        });
      }
      if (columnsArray.includes('estimations') || columnsArray.includes('EstimationV2')) {
        queryIncludes.push({
          model: EstimationV2,
          as: 'estimations',
          required: false,
        });
      }
      if (columnsArray.includes('ratings') || columnsArray.includes('RatingV2')) {
        queryIncludes.push({
          model: RatingV2,
          as: 'ratings',
          required: false,
        });
      }
      if (columnsArray.includes('coBenefits') || columnsArray.includes('CoBenefitV2')) {
        queryIncludes.push({
          model: CoBenefitV2,
          as: 'coBenefits',
          required: false,
        });
      }
    }

    const record = await ProjectV2.findByPk(id, {
      include: queryIncludes.length > 0 ? queryIncludes : undefined,
    });

    if (!record) {
      return res.status(404).json({
        message: 'Project not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('[v2]: Error retrieving project:', err);
    res.status(400).json({
      message: 'Error retrieving project',
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
    const existingRecord = await ProjectV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Project not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = projectV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating project',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating project',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Check for forbidden orgUid field
    if (updateData.hasOwnProperty('orgUid')) {
      return res.status(400).json({
        message: 'Error updating project',
        error: 'orgUid is automatically set from home organization and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign key if provided
    if (updateData.cadTrustProgramId) {
      try {
        await assertRecordExistanceOrStaged(
          ProgramV2,
          updateData.cadTrustProgramId,
          `cadTrustProgramId '${updateData.cadTrustProgramId}' does not exist. Please create the program first or use a valid cadTrustProgramId`,
        );
      } catch (err) {
        return res.status(400).json({
          message: 'Error updating project',
          error: err.message,
          success: false,
        });
      }
    }

    // Get home organization and set orgUid automatically (for non-transfer updates)
    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error updating project',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_project_id: id, // Use UUID string directly
      org_uid: homeOrg.org_uid, // Automatically set from home organization
    };

    if (updateData.projectRegistryName !== undefined) dbUpdateData.project_registry_name = updateData.projectRegistryName;
    if (updateData.projectId !== undefined) dbUpdateData.project_id = updateData.projectId;
    if (updateData.projectCreditingProgram !== undefined) dbUpdateData.project_crediting_program = updateData.projectCreditingProgram;
    if (updateData.projectName !== undefined) dbUpdateData.project_name = updateData.projectName;
    if (updateData.projectLink !== undefined) dbUpdateData.project_link = updateData.projectLink;
    if (updateData.projectDescription !== undefined) dbUpdateData.project_description = updateData.projectDescription;
    if (updateData.projectSector !== undefined) dbUpdateData.project_sector = updateData.projectSector;
    if (updateData.projectType !== undefined) dbUpdateData.project_type = updateData.projectType;
    if (updateData.projectSubtype !== undefined) dbUpdateData.project_subtype = updateData.projectSubtype;
    if (updateData.projectStatus !== undefined) dbUpdateData.project_status = updateData.projectStatus;
    if (updateData.projectStatusDate !== undefined) dbUpdateData.project_status_date = updateData.projectStatusDate;
    if (updateData.projectUnitMetric !== undefined) dbUpdateData.project_unit_metric = updateData.projectUnitMetric;
    if (updateData.cadTrustReferenceProjectId !== undefined) dbUpdateData.cad_trust_reference_project_id = updateData.cadTrustReferenceProjectId;
    if (updateData.cadTrustProgramId !== undefined) dbUpdateData.cad_trust_program_id = updateData.cadTrustProgramId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'project',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project update staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('[v2]: Error updating project:', err);
    res.status(400).json({
      message: 'Error updating project',
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
    const existingRecord = await ProjectV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Project not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'project',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_project_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project delete staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('[v2]: Error deleting project:', err);
    res.status(400).json({
      message: 'Error deleting project',
      error: err.message,
      success: false,
    });
  }
};

/**
 * Transfer a project between organizations
 * PUT /v2/project/transfer
 * Requires staging table to be empty
 */
export const transfer = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertStagingTableIsEmpty();

    const { cadTrustProjectId } = req.body;

    if (!cadTrustProjectId) {
      return res.status(400).json({
        message: 'cadTrustProjectId is required',
        success: false,
      });
    }

    // Use the model's transfer method
    await ProjectV2.transfer(cadTrustProjectId);

    res.json({
      message: 'Project transfer staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error transferring project', {
      error: err.message,
      stack: err.stack,
      headersSent: res.headersSent,
    });

    if (res.headersSent) {
      loggerV2.error('[v2]: Response already sent, cannot send error response');
      return;
    }

    res.status(400).json({
      message: 'Error transferring project',
      error: err.message,
      success: false,
    });
  }
};

/**
 * Update projects from XLSX file
 * PUT /v2/project/xlsx
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
    await ProjectV2.updateFromXLS(req.file.buffer);

    res.json({
      message: 'Updates from xlsx added to staging',
      success: true,
    });
  } catch (error) {
    logger.error('[v2]: Error updating projects from XLSX:', error);
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Batch upload projects from CSV file
 * POST /v2/project/batch
 * Requires CSV file upload via multer
 */
export const batchUpload = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    if (!req.file) {
      return res.status(400).json({
        message: 'Cannot find the required csv file in request',
        success: false,
      });
    }

    // Use the model's batchUpload method
    await ProjectV2.batchUpload({ data: req.file.buffer });

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
