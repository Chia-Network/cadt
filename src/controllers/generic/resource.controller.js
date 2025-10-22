import { uuid as uuidv4 } from 'uuidv4';
import { assertIfReadOnlyMode, assertHomeOrgExists, assertNoPendingCommits } from '../../utils/data-assertions.js';
import { optionallyPaginatedResponse, paginationParams } from '../../utils/helpers.js';
import { logger } from '../../config/logger.js';

/**
 * Creates a generic CRUD controller for any resource
 * @param {Object} config - Configuration object
 * @param {Model} config.Model - Sequelize model
 * @param {Model} config.StagingModel - Staging model
 * @param {Object} config.validationSchema - Joi validation schema
 * @param {string} config.primaryKey - Primary key field name
 * @param {string} config.tableName - Table name for staging
 * @param {Function} config.assertRecordExistance - FK validation function
 * @param {Function} config.assertHomeOrgExists - Home org assertion function (optional, defaults to V1)
 * @returns {Object} Controller with CRUD methods
 */
export const createResourceController = ({
  Model,
  StagingModel,
  validationSchema,
  primaryKey,
  tableName,
  assertRecordExistance,
  assertHomeOrgExists: customAssertHomeOrgExists = assertHomeOrgExists,
}) => {
  return {
    async create(req, res) {
      try {
        await assertIfReadOnlyMode();
        await customAssertHomeOrgExists();

        const newRecord = req.body;

        // Generate UUID for primary key
        const uuid = uuidv4();
        newRecord[primaryKey] = uuid;

        // Reject timestamp fields in API requests (V2 requirement)
        const timestampFields = ['createdAt', 'updatedAt', 'created_at', 'updated_at'];
        const providedTimestampFields = timestampFields.filter(field => newRecord.hasOwnProperty(field));
        if (providedTimestampFields.length > 0) {
          return res.status(400).json({
            message: `Error creating new ${tableName}`,
            error: `Timestamp fields are not allowed in API requests: ${providedTimestampFields.join(', ')}`,
            success: false,
          });
        }

        // Validate input
        const { error, value } = validationSchema.validate(newRecord);
        if (error) {
          return res.status(400).json({
            message: `Error creating new ${tableName}`,
            error: error.details[0].message,
            success: false,
          });
        }

        // Validate foreign keys if assertRecordExistance is provided
        if (assertRecordExistance) {
          // This would need to be customized per model based on foreign key requirements
          // For now, we'll skip this and let individual controllers handle it
        }

        // Stage the record
        await StagingModel.create({
          uuid,
          table: tableName,
          action: 'INSERT',
          data: JSON.stringify([value]),
        });

        res.json({
          message: `${tableName} staged successfully`,
          uuid,
        });
      } catch (error) {
        logger.error(`Error creating ${tableName}:`, error);
        res.status(400).json({
          message: `Error creating new ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async findAll(req, res) {
      try {
        const { page, limit, orgUid, search } = req.query;
        const pagination = paginationParams(page, limit);

        const where = {};
        if (orgUid) where.orgUid = orgUid;
        // Add search logic if needed

        const records = await Model.findAndCountAll({
          where,
          ...pagination,
        });

        res.json(optionallyPaginatedResponse(records, page, limit));
      } catch (error) {
        logger.error(`Error retrieving ${tableName}:`, error);
        res.status(400).json({
          message: `Error retrieving ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async findOne(req, res) {
      try {
        const { id } = req.params;
        const record = await Model.findByPk(id);

        if (!record) {
          return res.status(404).json({
            message: `${tableName} not found`,
            success: false,
          });
        }

        res.json(record);
      } catch (error) {
        logger.error(`Error retrieving ${tableName}:`, error);
        res.status(400).json({
          message: `Error retrieving ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async update(req, res) {
      try {
        await assertIfReadOnlyMode();
        await customAssertHomeOrgExists();
        await assertNoPendingCommits();

        const { id } = req.params;
        const updateData = req.body;

        // Reject timestamp fields in API requests (V2 requirement)
        const timestampFields = ['createdAt', 'updatedAt', 'created_at', 'updated_at'];
        const providedTimestampFields = timestampFields.filter(field => updateData.hasOwnProperty(field));
        if (providedTimestampFields.length > 0) {
          return res.status(400).json({
            message: `Error updating ${tableName}`,
            error: `Timestamp fields are not allowed in API requests: ${providedTimestampFields.join(', ')}`,
            success: false,
          });
        }

        // Validate input
        const { error, value } = validationSchema.validate(updateData, { allowUnknown: true });
        if (error) {
          return res.status(400).json({
            message: `Error updating ${tableName}`,
            error: error.details[0].message,
            success: false,
          });
        }

        // Verify record exists
        if (assertRecordExistance) {
          await assertRecordExistance(Model, id);
        }

        // Stage the update
        await StagingModel.create({
          uuid: uuidv4(),
          table: tableName,
          action: 'UPDATE',
          data: JSON.stringify([{ [primaryKey]: id, ...value }]),
        });

        res.json({
          message: `${tableName} update staged successfully`,
        });
      } catch (error) {
        logger.error(`Error updating ${tableName}:`, error);
        res.status(400).json({
          message: `Error updating ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async destroy(req, res) {
      try {
        await assertIfReadOnlyMode();
        await customAssertHomeOrgExists();
        await assertNoPendingCommits();

        const { id } = req.params;

        // Verify record exists
        if (assertRecordExistance) {
          await assertRecordExistance(Model, id);
        }

        // Stage the delete
        await StagingModel.create({
          uuid: uuidv4(),
          table: tableName,
          action: 'DELETE',
          data: JSON.stringify([{ [primaryKey]: id }]),
        });

        res.json({
          message: `${tableName} delete staged successfully`,
        });
      } catch (error) {
        logger.error(`Error deleting ${tableName}:`, error);
        res.status(400).json({
          message: `Error deleting ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },
  };
};


