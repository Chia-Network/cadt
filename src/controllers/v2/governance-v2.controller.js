import _ from 'lodash';
import { GovernanceV2, MetaV2 } from '../../models/v2/index.js';
import { logger } from '../../config/logger.js';
import {
  assertIsActiveGovernanceBody,
  assertIfReadOnlyMode,
  assertWalletIsSynced,
  assertCanBeGovernanceBody,
} from '../../utils/data-assertions';
import { getConfig } from '../../utils/config-loader';
import glossary from '../../models/v2/governance-v2.stub.js';
import pickList from '../../models/v2/governance-v2.stub.js';

const CONFIG = getConfig().APP;

export const GovernanceV2Controller = {
  async findAll(req, res) {
    try {
      const results = await GovernanceV2.findAll();
      return res.json(results);
    } catch (error) {
      res.status(400).json({
        message: 'Cannot retrieve V2 Governance Data',
        error: error.message,
        success: false,
      });
    }
  },

  async isCreated(req, res) {
    try {
      const governanceBodyId = await MetaV2.findOne({
        where: { metaKey: 'governanceBodyId' },
        raw: true,
      });

      return res.json({
        exists: !!governanceBodyId,
        governanceBodyId: governanceBodyId?.metaValue || null,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Cannot check V2 governance body status',
        error: error.message,
        success: false,
      });
    }
  },

  async sync(req, res) {
    try {
      await GovernanceV2.sync();
      return res.json({
        message: 'V2 Governance data synced successfully',
        success: true,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Cannot sync V2 governance data',
        error: error.message,
        success: false,
      });
    }
  },

  async findPickList(req, res) {
    try {
      const pickListRecord = await GovernanceV2.findOne({
        where: { metaKey: 'pickList' },
        raw: true,
      });

      if (!pickListRecord) {
        return res.json(pickList);
      }

      const parsedPickList = JSON.parse(pickListRecord.metaValue);
      return res.json(parsedPickList);
    } catch (error) {
      res.status(400).json({
        message: 'Cannot retrieve V2 picklist',
        error: error.message,
        success: false,
      });
    }
  },

  async findGlossary(req, res) {
    try {
      const glossaryRecord = await GovernanceV2.findOne({
        where: { metaKey: 'glossary' },
        raw: true,
      });

      if (!glossaryRecord) {
        return res.json(glossary);
      }

      const parsedGlossary = JSON.parse(glossaryRecord.metaValue);
      return res.json(parsedGlossary);
    } catch (error) {
      res.status(400).json({
        message: 'Cannot retrieve V2 glossary',
        error: error.message,
        success: false,
      });
    }
  },

  async createGoveranceBody(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertWalletIsSynced();
      await assertCanBeGovernanceBody();

      const result = await GovernanceV2.createGoveranceBody();

      return res.json({
        message: 'V2 Governance body created successfully',
        governanceBodyId: result.governanceBodyId,
        governanceVersionId: result.governanceVersionId,
        success: true,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Cannot create V2 governance body',
        error: error.message,
        success: false,
      });
    }
  },

  async setDefaultOrgList(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertWalletIsSynced();
      await assertIsActiveGovernanceBody();

      const orgList = JSON.stringify(req.body);

      await GovernanceV2.updateGoveranceBodyData([
        { key: 'orgList', value: orgList },
      ]);

      return res.json({
        message: 'Committed this V2 organization list to the datalayer',
        success: true,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Cannot update V2 organization list',
        error: error.message,
        success: false,
      });
    }
  },

  async setPickList(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertWalletIsSynced();
      await assertIsActiveGovernanceBody();

      const pickList = JSON.stringify(req.body);

      await GovernanceV2.updateGoveranceBodyData([
        { key: 'pickList', value: pickList },
      ]);

      return res.json({
        message: 'Committed this V2 pick list to the datalayer',
        success: true,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Cannot update V2 picklist',
        error: error.message,
        success: false,
      });
    }
  },

  async setGlossary(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertWalletIsSynced();
      await assertIsActiveGovernanceBody();

      const glossary = JSON.stringify(req.body);

      await GovernanceV2.updateGoveranceBodyData([
        { key: 'glossary', value: glossary },
      ]);

      return res.json({
        message: 'Committed this V2 glossary to the datalayer',
        success: true,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Cannot update V2 glossary',
        error: error.message,
        success: false,
      });
    }
  },
};

