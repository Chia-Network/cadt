import { uuid as uuidv4 } from 'uuidv4';
import { Meta } from '../models';
import { Sequelize } from 'sequelize';

const Op = Sequelize.Op;

export const createDataLayerStore = async () => {
  return uuidv4();
};

export const pushChangeListToDataLayer = (storeId, changeList) => {
  console.log('!!!!!', storeId, changeList);
  return Promise.all(
    changeList.map(async (change) => {
      if (change.action === 'insert') {
        await Meta.create({
          metaKey: `${storeId}_${change.key}`,
          metaValue: change.value,
        });
      } else if (change.action === 'delete') {
        await Meta.destroy({
          where: { metaKey: `simulator_${storeId}_${change.key}` },
        });
      }
    }),
  );
};

export const getStoreData = async (storeId) => {
  if (storeId) {
    const results = await await Meta.findAll({
      where: {
        metaKey: { [Op.like]: `simulator_${storeId}%` },
      },
    });

    // return the store data in a form that mirrors that datalayer response
    return {
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
