import { uuid as uuidv4 } from 'uuidv4';
import { Simulator } from '../models';
import { Sequelize } from 'sequelize';
import { RandomHash } from 'random-hash';
import { randomBytes } from 'crypto';

const Op = Sequelize.Op;

const generateHash = new RandomHash({
  length: 55,
  charset: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
  rng: randomBytes,
});

export const createDataLayerStore = async () => {
  return uuidv4();
};

export const pushChangeListToDataLayer = async (storeId, changeList) => {
  console.log(storeId, changeList);
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
    });

    // return the store data in a form that mirrors that datalayer response
    return {
      root: `0x${generateHash()}`,
      keys_values: results.map((result) => {
        const simulatedResult = result;
        simulatedResult.hash = result.metaValue.split('').reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
        simulatedResult.atom = null;
        simulatedResult.key = result.metaKey;
        simulatedResult.value = result.metaValue;
        return simulatedResult;
      }),
    };
  }

  return new Error('Error getting datalayer store data');
};

// eslint-disable-next-line
export const getRoot = (storeId) => {
  return Promise.resolve({
    // fake hash
    hash: `0x${generateHash()}`,
    success: true,
  });
};

export const getRoots = (storeIds) => {
  return Promise.resolve({
    hash: storeIds.map(() => `0x${generateHash()}`),
    success: true,
  });
};
