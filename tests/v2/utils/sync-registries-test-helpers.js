import { v4 as uuidv4 } from 'uuid';
import { encodeHex } from '../../../src/utils/datalayer-utils.js';

/**
 * Test utilities for comprehensive sync-registries-v2 tests
 */

/**
 * Creates mock root history array
 * @param {number} generations - Number of generations to create
 * @param {boolean} allConfirmed - Whether all roots should be confirmed
 * @returns {Array} Array of root history entries
 */
export const createMockRootHistory = (generations = 3, allConfirmed = true) => {
  const history = [];
  const baseTimestamp = Date.now() / 1000;

  for (let i = 0; i < generations; i++) {
    // Generate deterministic hash based on generation index
    const hashSeed = `test-root-${i}`;
    const hash = Buffer.from(hashSeed).toString('hex').padStart(64, '0');

    history.push({
      confirmed: allConfirmed || i < generations - 1, // Last one might be unconfirmed
      root_hash: `0x${hash}`,
      timestamp: Math.floor(baseTimestamp + i * 1000), // 1 second apart
    });
  }

  // Reverse so newest is first (index 0)
  return history.reverse();
};

/**
 * Creates mock kv diff array with INSERT/DELETE operations
 * @param {Array} operations - Array of operation objects: { type: 'INSERT'|'DELETE', modelKey: string, record: object }
 * @param {string} comment - Optional comment
 * @param {string} author - Optional author
 * @returns {Array} Array of kv diff entries
 */
export const createMockKvDiff = (operations = [], comment = '', author = '') => {
  const diff = [];

  // Add comment if provided
  if (comment) {
    diff.push({
      key: encodeHex('comment'),
      value: encodeHex(JSON.stringify({ comment })),
      type: 'INSERT',
    });
  }

  // Add author if provided
  if (author) {
    diff.push({
      key: encodeHex('author'),
      value: encodeHex(JSON.stringify({ author })),
      type: 'INSERT',
    });
  }

  // Add model operations
  operations.forEach((op) => {
    const { type, modelKey, record } = op;
    const key = `${modelKey}|${record[getPrimaryKeyForModel(modelKey)] || uuidv4()}`;

    diff.push({
      key: encodeHex(key),
      value: type === 'INSERT' ? encodeHex(JSON.stringify(record)) : null,
      type,
    });
  });

  return diff;
};

/**
 * Gets primary key field name for a model key
 * @param {string} modelKey - Model key (e.g., 'project', 'unit')
 * @returns {string} Primary key field name
 */
const getPrimaryKeyForModel = (modelKey) => {
  const primaryKeyMap = {
    program: 'cad_trust_program_id',
    methodology: 'cad_trust_methodology_id',
    project: 'cad_trust_project_id',
    validation: 'cad_trust_validation_id',
    verification: 'cad_trust_verification_id',
    issuance: 'cad_trust_issuance_id',
    unit: 'cad_trust_unit_id',
    location: 'cad_trust_location_id',
    estimation: 'cad_trust_estimation_id',
    rating: 'cad_trust_rating_id',
    co_benefit: 'cad_trust_co_benefit_id',
    project_methodology: 'id',
    stakeholder: 'cad_trust_stakeholder_id',
    stakeholder_projects: 'id',
    label: 'cad_trust_label_id',
    unit_label: 'id',
    aef_t1_submission: 'cad_trust_aef_t1_submission_id',
    aef_t5_authorized_entities: 'cad_trust_aef_t5_authorized_entities_id',
    aef_t2_authorizations: 'cad_trust_aef_t2_authorizations_id',
    aef_t3_actions: 'cad_trust_aef_t3_actions_id',
    aef_t4_holdings: 'cad_trust_aef_t4_holdings_id',
  };
  return primaryKeyMap[modelKey] || 'id';
};

/**
 * Sets up test organization with registry ID
 * @param {string} orgUid - Organization UID
 * @param {string} registryId - Registry store ID
 * @param {boolean} isHome - Whether this is the home org
 * @returns {Promise<Object>} Organization record
 */
export const setupTestOrganization = async (orgUid, registryId, isHome = false) => {
  const { OrganizationsV2 } = await import('../../../src/models/v2/index.js');

  const org = await OrganizationsV2.create({
    org_uid: orgUid,
    name: `Test Org ${orgUid}`,
    is_home: isHome,
    subscribed: true,
    synced: false,
    sync_remaining: 0,
    balance: '0',
    pending_balance: '0',
    metadata: '{}',
    registry_id: registryId,
    registry_hash: null,
  });

  return org;
};

/**
 * Sets up test governance data with orgList
 * @param {Array<string>} orgList - Array of organization UIDs
 * @returns {Promise<Object>} Governance record
 */
export const setupTestGovernanceData = async (orgList = []) => {
  const { GovernanceV2 } = await import('../../../src/models/v2/index.js');

  const governance = await GovernanceV2.create({
    org_list: JSON.stringify(orgList),
    glossary: JSON.stringify({}),
    pick_list: JSON.stringify({}),
    confirmed: true,
  });

  return governance;
};

/**
 * Creates a test project record
 * @param {string} orgUid - Organization UID
 * @param {string} projectId - Project ID
 * @returns {Object} Project record data
 */
export const createTestProjectRecord = (orgUid, projectId = 'TEST-PROJ-001') => {
  return {
    cad_trust_project_id: uuidv4(),
    org_uid: orgUid,
    project_registry_name: 'Test Registry',
    project_id: projectId,
    project_name: `Test Project ${projectId}`,
    project_type: 'CARBON_CREDIT',
  };
};

/**
 * Creates a test unit record
 * @param {string} orgUid - Organization UID
 * @param {string} issuanceId - Issuance ID
 * @param {string} unitSerialId - Unit serial ID
 * @returns {Object} Unit record data
 */
export const createTestUnitRecord = (orgUid, issuanceId, unitSerialId = 'TEST-UNIT-001') => {
  return {
    cad_trust_unit_id: uuidv4(),
    org_uid: orgUid,
    cad_trust_issuance_id: issuanceId,
    unit_serial_id: unitSerialId,
    unit_start_block: 'A001',
    unit_end_block: 'A100',
    unit_vintage_year: 2024,
  };
};

