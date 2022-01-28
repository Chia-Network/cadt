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
    const results = await await Simulator.findAll({
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
      success: false,
    });
  }

  let hash = 0;

  if (myOrganization.registryId === storeId) {
    createHash('md5').update(JSON.stringify(simulatorTable)).digest('hex');
  }

  return Promise.resolve({
    hash,
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
      hash: null,
      success: false,
    });
  }

  return Promise.resolve({
    hash: storeIds.map((storeId) => {
      if (myOrganization.registryId === storeId) {
        return createHash('md5')
          .update(JSON.stringify(simulatorTable))
          .digest('hex');
      }

      return 0;
    }),
    success: true,
  });
};
