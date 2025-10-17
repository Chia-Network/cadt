import { OrganizationsV2 } from '../../models/v2/index.js';
import { V2DatalayerService } from '../../services/v2-datalayer.service.js';
import { logger } from '../../config/logger.js';
import { assertIfReadOnlyMode, assertHomeOrgExists } from '../../utils/data-assertions.js';

export const OrganizationsV2Controller = {
  async create(req, res) {
    try {
      await assertIfReadOnlyMode();

      const { name, icon } = req.body;

      // Check if home organization already exists
      const existingHomeOrg = await OrganizationsV2.getHomeOrg(false);
      if (existingHomeOrg) {
        return res.status(400).json({
          message: 'Home organization already exists',
          orgUid: existingHomeOrg.orgUid,
          success: false,
        });
      }

      // Create V2 home organization
      const orgUid = await OrganizationsV2.createHomeOrganization(name, icon, 'v2');

      res.json({
        message: 'V2 Home organization created successfully',
        orgUid,
        success: true,
      });
    } catch (error) {
      logger.error('Error creating V2 home organization:', error);
      res.status(400).json({
        message: 'Error creating V2 home organization',
        error: error.message,
        success: false,
      });
    }
  },

  async getHomeOrg(req, res) {
    try {
      const homeOrg = await OrganizationsV2.getHomeOrg();

      if (!homeOrg) {
        return res.status(404).json({
          message: 'V2 Home organization not found',
          success: false,
        });
      }

      res.json(homeOrg);
    } catch (error) {
      logger.error('Error retrieving V2 home organization:', error);
      res.status(400).json({
        message: 'Error retrieving V2 home organization',
        error: error.message,
        success: false,
      });
    }
  },

  async subscribe(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertHomeOrgExists();

      const { orgUid } = req.params;

      if (!orgUid) {
        return res.status(400).json({
          message: 'Organization UID is required',
          success: false,
        });
      }

      // Subscribe to V2 organization stores
      const result = await OrganizationsV2.subscribeToOrganization(orgUid);

      res.json({
        message: 'V2 Organization subscribed successfully',
        ...result,
        success: true,
      });
    } catch (error) {
      logger.error('Error subscribing to V2 organization:', error);
      res.status(400).json({
        message: 'Error subscribing to V2 organization',
        error: error.message,
        success: false,
      });
    }
  },

  async findAll(req, res) {
    try {
      const organizations = await OrganizationsV2.findAll({
        order: [['createdAt', 'DESC']],
      });

      res.json(organizations);
    } catch (error) {
      logger.error('Error retrieving V2 organizations:', error);
      res.status(400).json({
        message: 'Error retrieving V2 organizations',
        error: error.message,
        success: false,
      });
    }
  },

  async findOne(req, res) {
    try {
      const { orgUid } = req.params;

      const organization = await OrganizationsV2.findOne({
        where: { orgUid },
      });

      if (!organization) {
        return res.status(404).json({
          message: 'V2 Organization not found',
          success: false,
        });
      }

      res.json(organization);
    } catch (error) {
      logger.error('Error retrieving V2 organization:', error);
      res.status(400).json({
        message: 'Error retrieving V2 organization',
        error: error.message,
        success: false,
      });
    }
  },

  async update(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertHomeOrgExists();

      const { orgUid } = req.params;
      const updateData = req.body;

      const organization = await OrganizationsV2.findOne({
        where: { orgUid },
      });

      if (!organization) {
        return res.status(404).json({
          message: 'V2 Organization not found',
          success: false,
        });
      }

      await OrganizationsV2.update(updateData, {
        where: { orgUid },
      });

      res.json({
        message: 'V2 Organization updated successfully',
        success: true,
      });
    } catch (error) {
      logger.error('Error updating V2 organization:', error);
      res.status(400).json({
        message: 'Error updating V2 organization',
        error: error.message,
        success: false,
      });
    }
  },
};



