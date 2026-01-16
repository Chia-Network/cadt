'use strict';

import _ from 'lodash';

import { GovernanceV2, MetaV2 } from '../../models/v2/index.js';
import { loggerV2 } from '../../config/logger.js';
import { getConfig, getConfigV2 } from '../../utils/config-loader.js';
import glossary from '../../models/governance/glossary.stub.js';
import pickList from '../../models/governance/governance-v2.stub.js';
import PickListV2Real from '../../models/governance/governance-v2-real-picklists.js';
import {
  assertCanBeGovernanceBodyV2,
  assertIsActiveGovernanceBodyV2,
  assertV2IfReadOnlyMode,
} from '../../utils/v2-data-assertions.js';

/**
 * Get all GovernanceV2 records
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with all governance records
 */
export const findAll = async (req, res) => {
  try {
    const results = await GovernanceV2.findAll();
    return res.json(results);
  } catch (error) {
    loggerV2.error('[v2]: Error retrieving governance data:', error);
    res.status(400).json({
      message: 'Cannot retrieve Governance Data',
      error: error.message || 'An internal error occurred while retrieving governance data',
      success: false,
    });
  }
};

/**
 * Check if governance body exists
 * Queries MetaV2 for 'governanceBodyId' to verify governance body is set up
 * Returns the main governance body ID if one exists (the ID to share with other instances)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with created status and governance body ID
 */
export const isCreated = async (req, res) => {
  try {
    const results = await MetaV2.findOne({
      where: { meta_key: 'governanceBodyId' },
    });

    if (results) {
      // Get the main governance body ID (the one to share with other instances)
      const mainGovernanceBodyId = await MetaV2.findOne({
        where: { meta_key: 'mainGoveranceBodyId' },
      });

      return res.json({
        created: true,
        success: true,
        governanceBodyId: mainGovernanceBodyId?.meta_value || null,
      });
    } else {
      return res.json({
        created: false,
        success: true,
      });
    }
  } catch (error) {
    loggerV2.error('[v2]: Error retrieving governance data:', error);
    res.status(400).json({
      message: 'Cannot retrieve Governance Data',
      error: error.message || 'An internal error occurred while retrieving governance data',
      success: false,
    });
  }
};

/**
 * Get orgList from GovernanceV2, parse JSON
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with parsed orgList
 */
export const findOrgList = async (req, res) => {
  try {
    const results = await GovernanceV2.findOne({
      where: { meta_key: 'orgList' },
    });
    return res.json(JSON.parse(_.get(results, 'meta_value', '{}')));
  } catch (error) {
    loggerV2.error('[v2]: Error retrieving governance data:', error);
    res.status(400).json({
      message: 'Cannot retrieve Governance Data',
      error: error.message || 'An internal error occurred while retrieving governance data',
      success: false,
    });
  }
};

/**
 * Get glossary from GovernanceV2, parse JSON
 * Uses stub in dev/simulator mode
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with glossary data
 */
export const findGlossary = async (req, res) => {
  try {
    const { USE_DEVELOPMENT_MODE, USE_SIMULATOR } = getConfig().APP;
    if (USE_DEVELOPMENT_MODE || USE_SIMULATOR) {
      return res.json(glossary);
    }

    const results = await GovernanceV2.findOne({
      where: { meta_key: 'glossary' },
    });

    if (!results || !results.meta_value) {
      return res.json({});
    }

    return res.json(JSON.parse(results.meta_value));
  } catch (error) {
    loggerV2.error('[v2]: Error retrieving governance data:', error);
    res.status(400).json({
      message: 'Cannot retrieve Governance Data',
      error: error.message || 'An internal error occurred while retrieving governance data',
      success: false,
    });
  }
};

/**
 * Get pickList from GovernanceV2, parse JSON
 * Falls back to hardcoded picklist if governance node doesn't provide one
 * Uses stub in dev/simulator mode
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with pickList data
 */
export const findPickList = async (req, res) => {
  try {
    const { USE_DEVELOPMENT_MODE, USE_SIMULATOR } = getConfig().APP;
    if (USE_DEVELOPMENT_MODE || USE_SIMULATOR) {
      return res.json(pickList);
    }

    const results = await GovernanceV2.findOne({
      where: { meta_key: 'pickList' },
    });

    if (!results || !results.meta_value) {
      // Fallback to hardcoded picklist if governance node doesn't provide one
      loggerV2.info('[v2]: Picklist not found in governance data, using hardcoded fallback picklist');
      return res.json(PickListV2Real);
    }

    return res.json(JSON.parse(results.meta_value));
  } catch (error) {
    // Fallback to hardcoded picklist on error (can't connect, parse error, etc.)
    loggerV2.warn(`[v2]: Error retrieving picklist from governance, using hardcoded fallback: ${error.message}`);
    return res.json(PickListV2Real);
  }
};

/**
 * Create a new governance body for V2
 * Creates main governance body store and V2-specific store
 * Automatically detects existing V1 governance and upgrades it if needed
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success message
 */
export const createGoveranceBody = async (req, res) => {
  try {
    await assertCanBeGovernanceBodyV2();

    // Validate synchronously before starting background work
    const { GOVERNANCE_BODY_ID } = getConfigV2().GOVERNANCE;
    if (GOVERNANCE_BODY_ID && GOVERNANCE_BODY_ID !== '') {
      return res.status(400).json({
        message: 'Cannot create V2 Governance Body',
        error:
          'You are already listening to another governance body. Please clear GOVERNANCE_BODY_ID from your V2 config and try again',
        success: false,
      });
    }

    // Start governance body creation in the background
    // Don't await - let it run asynchronously
    GovernanceV2.createGoveranceBody().catch((error) => {
      loggerV2.error('[v2]: Error creating governance body in background:', error);
    });

    // Return immediately - work happens in background
    return res.json({
      message:
        'Setting up new V2 Governance Body on this node, this can take a few mins',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant create V2 Governance Body',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Update orgList in governance body
 * Uses validation schema to ensure proper format
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success message
 */
export const setDefaultOrgList = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertIsActiveGovernanceBodyV2();

    const orgList = JSON.stringify(req.body);

    await GovernanceV2.updateGoveranceBodyData([
      { key: 'orgList', value: orgList },
    ]);

    return res.json({
      message: 'Committing this new organization list to the datalayer',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error updating default orgs:', error);
    res.status(400).json({
      message: 'Cannot update default orgs',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Update pickList in governance body
 * Uses validation schema to ensure proper format
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success message
 */
export const setPickList = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertIsActiveGovernanceBodyV2();

    const pickListData = JSON.stringify(req.body);

    await GovernanceV2.updateGoveranceBodyData([
      { key: 'pickList', value: pickListData },
    ]);

    return res.json({
      message: 'Committing this pick list to the datalayer',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error updating picklist:', error);
    res.status(400).json({
      message: 'Cannot update picklist',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Update glossary in governance body
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success message
 */
export const setGlossary = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertIsActiveGovernanceBodyV2();

    const glossaryData = JSON.stringify(req.body);

    await GovernanceV2.updateGoveranceBodyData([
      { key: 'glossary', value: glossaryData },
    ]);

    return res.json({
      message: 'Committing glossary to the datalayer',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error updating glossary:', error);
    res.status(400).json({
      message: 'Cannot update glossary',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Sync governance data from datalayer
 * Triggers synchronization of governance data from subscribed governance body
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success message
 */
export const sync = async (req, res) => {
  try {
    GovernanceV2.sync();
    return res.json({
      message: 'Syncing V2 Governance Body',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cannot sync V2 Governance Body',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Subscribe to a governance body store
 * Subscribes to the specified governance body store on datalayer
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success message
 */
export const subscribeToGovernanceBody = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();

    const { governanceBodyId } = req.body;

    if (!governanceBodyId) {
      return res.status(400).json({
        message: 'governanceBodyId is required',
        success: false,
      });
    }

    await GovernanceV2.subscribeToGovernanceBody(governanceBodyId);

    return res.json({
      message: 'Subscribed to governance body',
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error subscribing to governance body: ${error.message}`);
    res.status(400).json({
      message: 'Error subscribing to governance body',
      error: error.message,
      success: false,
    });
  }
};

