'use strict';

import { v4 as uuidv4 } from 'uuid';
import { LocationV2, LocationV2Mirror, ProjectV2, StagingV2 } from '../../models/v2/index.js';
import { locationV2Schema } from '../../validations/v2/location-v2.validations.js';
import {
  assertRecordExistanceOrStaged,
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { loggerV2 } from '../../config/logger.js';

// Generic CRUD controller factory for LocationV2
const createLocationController = (Model, ModelMirror, schema) => {
  return {
    // Create new location
    async create(req, res) {
      try {
        await assertV2IfReadOnlyMode();
        await assertV2HomeOrgExists();
        await assertNoPendingCommitsExcludingTransfers();

        const newRecord = req.body;

        // Check for forbidden ID field
        if (newRecord.hasOwnProperty('cadTrustLocationId')) {
          return res.status(400).json({
            message: 'Error creating new location',
            error: 'cadTrustLocationId is auto-generated and cannot be set via API',
            success: false,
          });
        }

        // Validate request body
        const { error, value } = schema.validate(newRecord);
        if (error) {
          loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
          const errorMessage = error.details && error.details.length > 0
            ? error.details[0].message
            : error.message || 'Validation error';
          return res.status(400).json({
            message: 'Error creating location',
            error: errorMessage,
            success: false,
          });
        }

        // Validate foreign key: cadTrustProjectId
        try {
          await assertRecordExistanceOrStaged(ProjectV2, value.cadTrustProjectId, 'cadTrustProjectId');
        } catch (err) {
          return res.status(400).json({
            message: 'Error creating location',
            error: err.message,
            success: false,
          });
        }

        // Generate UUID for staging
        const uuid = uuidv4();

        // Generate UUID for primary key
        const cadTrustLocationId = uuidv4();

        // Convert camelCase to snake_case for database
        const dbRecord = {
          cad_trust_location_id: cadTrustLocationId,
          location_country: value.locationCountry,
          location_region: value.locationRegion,
          location_gis: value.locationGis,
          location_map_type: value.locationMapType,
          location_map_file_link: value.locationMapFileLink,
          cad_trust_project_id: value.cadTrustProjectId,
        };

        // Stage the record
        await StagingV2.create({
          uuid,
          table: 'location',
          action: 'INSERT',
          data: JSON.stringify([dbRecord]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        res.json({
          message: 'Location staged successfully',
          uuid,
          cadTrustLocationId,
          success: true,
        });
      } catch (err) {
        loggerV2.error('[v2]: Error creating location:', err);
        res.status(400).json({
          message: 'Error creating location',
          error: err.message,
          success: false,
        });
      }
    },

    // Get all locations
    async findAll(req, res) {
      try {
        const { orgUid } = req.query;
        const resolvedOrgUid = await resolveOrgUid(orgUid);

        const queryOptions = {};
        if (resolvedOrgUid) {
          queryOptions.include = [{
            model: ProjectV2,
            as: 'project',
            attributes: [],
            where: { orgUid: resolvedOrgUid },
            required: true,
          }];
        }

        const locations = await Model.findAll(queryOptions);

        res.json({
          message: 'Locations retrieved successfully',
          data: locations,
          success: true,
        });
      } catch (err) {
        loggerV2.error('[v2]: Error retrieving locations:', err);
        res.status(500).json({
          message: 'Error retrieving locations',
          error: err.message,
          success: false,
        });
      }
    },

    // Get location by ID
    async findOne(req, res) {
      try {
        const { id } = req.params;
        const location = await Model.findByPk(id);

        if (!location) {
          return res.status(404).json({
            message: 'Location not found',
            success: false,
          });
        }

        res.json(location);
      } catch (err) {
        loggerV2.error('[v2]: Error retrieving location:', err);
        res.status(500).json({
          message: 'Error retrieving location',
          error: err.message,
          success: false,
        });
      }
    },

    // Update location
    async update(req, res) {
      try {
        await assertV2IfReadOnlyMode();
        await assertV2HomeOrgExists();
        await assertNoPendingCommitsExcludingTransfers();

        const { id } = req.params;
        const updateData = req.body;

        // Validate request body
        const { error, value } = schema.validate(updateData);
        if (error) {
          loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
          const errorMessage = error.details && error.details.length > 0
            ? error.details[0].message
            : error.message || 'Validation error';
          return res.status(400).json({
            message: 'Error updating location',
            error: errorMessage,
            success: false,
          });
        }

        // Validate foreign key: cadTrustProjectId
        try {
          await assertRecordExistanceOrStaged(ProjectV2, value.cadTrustProjectId, 'cadTrustProjectId');
        } catch (err) {
          return res.status(400).json({
            message: 'Error updating location',
            error: err.message,
            success: false,
          });
        }

        // Check if location exists
        const existingLocation = await Model.findByPk(id);
        if (!existingLocation) {
          return res.status(404).json({
            message: 'Location not found',
            success: false,
          });
        }

        // Convert camelCase to snake_case for database
        const dbUpdateData = {
          cad_trust_location_id: id, // Use UUID string directly
        };

        if (value.locationCountry !== undefined) dbUpdateData.location_country = value.locationCountry;
        if (value.locationRegion !== undefined) dbUpdateData.location_region = value.locationRegion;
        if (value.locationGis !== undefined) dbUpdateData.location_gis = value.locationGis;
        if (value.locationMapType !== undefined) dbUpdateData.location_map_type = value.locationMapType;
        if (value.locationMapFileLink !== undefined) dbUpdateData.location_map_file_link = value.locationMapFileLink;
        if (value.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = value.cadTrustProjectId;

        // Generate UUID for staging
        const uuid = uuidv4();

        // Stage the update
        await StagingV2.create({
          uuid,
          table: 'location',
          action: 'UPDATE',
          data: JSON.stringify([dbUpdateData]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        res.json({
          message: 'Location updated successfully',
          uuid,
          success: true,
        });
      } catch (err) {
        loggerV2.error('[v2]: Error updating location:', err);
        res.status(400).json({
          message: 'Error updating location',
          error: err.message,
          success: false,
        });
      }
    },

    // Delete location
    async delete(req, res) {
      try {
        await assertV2IfReadOnlyMode();
        await assertV2HomeOrgExists();
        await assertNoPendingCommitsExcludingTransfers();

        const { id } = req.params;

        // Check if location exists
        const existingLocation = await Model.findByPk(id);
        if (!existingLocation) {
          return res.status(404).json({
            message: 'Location not found',
            success: false,
          });
        }

        // Generate UUID for staging
        const uuid = uuidv4();

        // Stage the delete
        await StagingV2.create({
          uuid,
          table: 'location',
          action: 'DELETE',
          data: JSON.stringify([{ cad_trust_location_id: id }]), // Use UUID string directly
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        res.json({
          message: 'Location deleted successfully',
          uuid,
          success: true,
        });
      } catch (err) {
        loggerV2.error('[v2]: Error deleting location:', err);
        res.status(400).json({
          message: 'Error deleting location',
          error: err.message,
          success: false,
        });
      }
    },
  };
};

// Create the location controller
const locationController = createLocationController(LocationV2, LocationV2Mirror, locationV2Schema);

export default locationController;
