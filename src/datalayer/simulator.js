import { uuid as uuidv4 } from 'uuidv4';
import { Simulator, Organization } from '../models';
import { Sequelize } from 'sequelize';
import { createHash } from 'crypto';
import logUpdate from 'log-update';

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
          simulatedResult.key = result.key;
          simulatedResult.value = result.value;
          return simulatedResult;
        }),
    };
  }

  return new Error('Error getting datalayer store data');
};

// eslint-disable-next-line
export const getRoot = async (storeId) => {
  const simulatorTable = await Simulator.findAll({ raw: true });

  const myOrganization = await Organization.findOne({
    where: { isHome: true },
    raw: true,
  });

  if (!myOrganization) {
    logUpdate(
      `Cant get root, Home org does not yet exist ${
        frames[Math.floor(Math.random() * 3)]
      }`,
    );
    return Promise.resolve({
      hash: null,
      status: 2,
      success: false,
    });
  }

  let hash = 0;

  if (myOrganization.registryId === storeId) {
    createHash('md5').update(JSON.stringify(simulatorTable)).digest('hex');
  }

  return Promise.resolve({
    hash,
    status: 2,
    success: true,
  });
};

export const getRoots = async (storeIds) => {
  const simulatorTable = await Simulator.findAll({ raw: true });
  const myOrganization = await Organization.findOne({
    where: { isHome: true },
    raw: true,
  });

  if (!myOrganization) {
    logUpdate(
      `Cant get root, Home org does not yet exist ${
        frames[Math.floor(Math.random() * 3)]
      }`,
    );
    return Promise.resolve({
      root_hashes: [],
      success: false,
    });
  }

  return Promise.resolve({
    root_hashes: storeIds.map((storeId) => {
      if (myOrganization.registryId === storeId) {
        // datalayer returns hash starting in 0x
        return {
          hash: `0x${createHash('md5')
            .update(JSON.stringify(simulatorTable))
            .digest('hex')}`,
          id: storeId,
          status: 2,
        };
      }

      // no hash for simulated external org tables (they dont exist in simulator)
      return {
        hash: 0,
        id: storeId,
        status: 2,
      };
    }),
    success: true,
  });
};

export const dataLayerAvailable = async () => {
  return Promise.resolve(true);
};

// eslint-disable-next-line
export const subscribeToStoreOnDataLayer = async (storeId) => {};
