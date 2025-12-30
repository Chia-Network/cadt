import { v4 as uuidv4 } from 'uuid';
import { Simulator, Organization } from '../models';
import { Sequelize } from 'sequelize';
import { createHash } from 'crypto';

const Op = Sequelize.Op;

const frames = ['-', '\\', '|', '/'];

export const createDataLayerStore = async () => {
  return uuidv4();
};

export const pushChangeListToDataLayer = async (storeId, changeList) => {
  await Promise.all(
    changeList.map(async (change) => {
      if (change.action === 'insert') {
        await Simulator.upsert({
          key: `${storeId}_${change.key}`,
          value: change.value,
        });
      } else if (change.action === 'delete') {
        await Simulator.destroy({
          where: { key: `${storeId}_${change.key}` },
        });
      }
    }),
  );
};

export const getStoreData = async (storeId) => {
  if (storeId) {
    const results = await Simulator.findAll({
      attributes: ['key', 'value'],
      where: {
        key: { [Op.like]: `${storeId}%` },
      },
      raw: true,
    });

    // return the store data in a form that mirrors that datalayer response
    return {
      root: createHash('md5').update(JSON.stringify(results)).digest('hex'),
      keys_values: results
        .filter((result) => result.value)
        .map((result) => {
          const simulatedResult = result;

          simulatedResult.hash = createHash('md5')
            .update(result.value)
            .digest('hex');
          simulatedResult.atom = null;
          // Strip storeId prefix from key (format: `${storeId}_${hexEncodedKey}`)
          // The key stored is `${storeId}_${hexEncodedKey}`, but we need to return just the hex part
          const keyPrefix = `${storeId}_`;
          simulatedResult.key = result.key.startsWith(keyPrefix)
            ? result.key.substring(keyPrefix.length)
            : result.key;
          simulatedResult.value = result.value;
          return simulatedResult;
        }),
    };
  }

  return new Error('Error getting datalayer store data');
};

export const getRoot = async (storeId) => {
  const simulatorTable = await Simulator.findAll({ raw: true });

  // Find the home organization that matches this specific storeId
  // Check V1 first
  let myOrganization = await Organization.findOne({
    where: { isHome: true, registryId: storeId },
    raw: true,
  });

  // If no V1 org matches, check V2
  if (!myOrganization) {
    try {
      const { OrganizationsV2 } = await import('../models/v2/index.js');
      const v2Org = await OrganizationsV2.findOne({
        where: { is_home: true, registry_id: storeId },
        raw: true,
      });
      if (v2Org) {
        // Convert V2 org to V1 format for compatibility
        myOrganization = {
          registryId: v2Org.registry_id,
        };
      }
    } catch (error) {
      // V2 models might not be loaded, that's OK
    }
  }

  if (!myOrganization) {
    return Promise.resolve({
      hash: null,
      confirmed: true,
      success: false,
    });
  }

  // Calculate hash based on all data in simulator table
  // Simple MD5 hash of the entire table contents
  const hash = createHash('md5')
    .update(JSON.stringify(simulatorTable))
    .digest('hex');

  return Promise.resolve({
    hash,
    confirmed: true,
    success: true,
  });
};

export const getRoots = async (storeIds) => {
  const simulatorTable = await Simulator.findAll({ raw: true });

  // Get ALL home organizations (both V1 and V2)
  const v1Orgs = await Organization.findAll({
    where: { isHome: true },
    raw: true,
  });

  let v2Orgs = [];
  try {
    const { OrganizationsV2 } = await import('../models/v2/index.js');
    const v2Results = await OrganizationsV2.findAll({
      where: { is_home: true },
      raw: true,
    });
    // Convert V2 orgs to V1 format
    v2Orgs = v2Results.map(v2Org => ({
      registryId: v2Org.registry_id,
    }));
  } catch (error) {
    // V2 models might not be loaded, that's OK
  }

  const allOrgs = [...v1Orgs, ...v2Orgs];

  if (allOrgs.length === 0) {
    const logUpdate = (await import('log-update')).default;
    logUpdate(
      `Cant get roots, No home orgs exist yet ${
        frames[Math.floor(Math.random() * 3)]
      }`,
    );
    return Promise.resolve({
      root_hashes: [],
      success: false,
    });
  }

  // Create a map of registryId -> org for quick lookup
  const orgByRegistryId = new Map();
  allOrgs.forEach(org => {
    orgByRegistryId.set(org.registryId, org);
  });

  // Calculate hash once for all stores (shared simulator table)
  const hash = createHash('md5')
    .update(JSON.stringify(simulatorTable))
    .digest('hex');

  return Promise.resolve({
    root_hashes: storeIds.map((storeId) => {
      const orgForStore = orgByRegistryId.get(storeId);

      if (orgForStore) {
        // Return hash for home org stores
        return {
          hash: `0x${hash}`,
          id: storeId,
          confirmed: true,
        };
      }

      // no hash for simulated external org tables (they dont exist in simulator)
      return {
        hash: 0,
        id: storeId,
        confirmed: true,
      };
    }),
    success: true,
  });
};

// Track root history for simulator mode
// This maintains a simple 2-generation history to make sync work
// Generation 0 (initial) + Generation 1 (current state)
const rootHistoryCache = new Map(); // Map<storeId, {lastHash: string, generation: number}>

export const getRootHistory = async (storeId) => {
  // Get current root hash (always fetch fresh to detect changes)
  const { hash } = await getRoot(storeId);

  if (!hash) {
    return [];
  }

  // Simple V1-style history: Always return generation 0 (empty) + generation 1 (current)
  // This is what V1 sync expects in simulator mode - it doesn't track dynamic generations
  const history = [
    {
      confirmed: true,
      root_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Date.now() - 1000,
    },
    {
      confirmed: true,
      root_hash: `0x${hash}`,
      timestamp: Date.now(),
    },
  ];

  return history;
};

export const dataLayerAvailable = async () => {
  return Promise.resolve(true);
};

// eslint-disable-next-line
export const subscribeToStoreOnDataLayer = async (storeId) => {};
