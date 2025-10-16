import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 as getSequelizeV2 } from '../../database/v2/index.js';
import { MetaV2 } from './meta-v2.model.js';
import datalayer from '../../datalayer';
import { keyValueToChangeList } from '../../utils/datalayer-utils';
import { getConfig } from '../../utils/config-loader';
import { getV2Config } from '../../utils/v2-config-loader';
import { logger } from '../../config/logger.js';
import { getDataModelVersion } from '../../utils/helpers';
import PickListStub from './governance-v2.stub.js';

const { GOVERNANCE_BODY_ID } = getConfig().GOVERNANCE;
const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

import ModelTypes from './governance-v2.modeltypes.cjs';

class GovernanceV2 extends Model {
  static async createGoveranceBody() {
    const existingGovernanceBody = await MetaV2.findOne({
      where: { metaKey: 'governanceBodyId' },
      raw: true,
    });

    if (existingGovernanceBody) {
      throw new Error(
        'You are already listening to another V2 governance body. Please clear GOVERNANCE_BODY_ID from your env and try again',
      );
    }

    const dataModelVersion = getDataModelVersion();
    const governanceBodyId = await datalayer.createDataLayerStore();
    const governanceVersionId = await datalayer.createDataLayerStore();

    const revertOrganizationIfFailed = async () => {
      logger.warn('Reverting Failed V2 Governance Body Creation');
      await MetaV2.destroy({ where: { metaKey: 'governanceBodyId' } });
    };

    // sync the V2 governance store
    await datalayer.syncDataLayer(
      governanceBodyId,
      {
        [dataModelVersion]: governanceVersionId,
      },
      revertOrganizationIfFailed,
    );

    const onConfirm = async () => {
      await MetaV2.upsert({
        metaKey: 'governanceBodyId',
        metaValue: governanceVersionId,
      });
      await MetaV2.upsert({
        metaKey: 'mainGoveranceBodyId',
        metaValue: governanceBodyId,
      });
      logger.info('V2 Governance body confirmed, you are ready to go');
    };

    if (!USE_SIMULATOR) {
      logger.info(
        'V2 create governance body process is waiting for all store creations to confirm on the blockchain',
      );
      await new Promise((resolve) => setTimeout(() => resolve(), 30000));
      await datalayer.waitForAllTransactionsToConfirm();
    }

    await datalayer.getStoreData(governanceBodyId, onConfirm, revertOrganizationIfFailed);

    return {
      governanceBodyId,
      governanceVersionId,
    };
  }

  static async upsertGovernanceDownload(
    sourceGovernanceBodyId,
    governanceData,
  ) {
    logger.debug(
      `upserting governance data from ${sourceGovernanceBodyId}`,
    );

    const changeList = [];

    await Promise.all(
      Object.keys(governanceData).map(async (key) => {
        const value = governanceData[key];
        const valueExists = await GovernanceV2.findOne({
          where: { metaKey: key },
          raw: true,
        });

        await GovernanceV2.upsert({
          metaKey: key,
          metaValue: value,
          confirmed: true,
        });

        changeList.push(
          ...keyValueToChangeList(key, value, valueExists),
        );
      }),
    );

    return changeList;
  }

  static async sync(retryCounter = 0) {
    try {
      logger.debug('running V2 governance model sync()');

      if (!GOVERNANCE_BODY_ID) {
        throw new Error('Missing information in env to sync V2 Governance data');
      }

      // If on simulator or testnet, use the stubbed picklist data and return
      if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
        logger.info('SIMULATOR/TESTNET MODE: Using sample V2 picklist');
        GovernanceV2.upsert({
          metaKey: 'pickList',
          metaValue: JSON.stringify(PickListStub),
          confirmed: true,
        });

        return;
      }

      const governanceData = await datalayer.getSubscribedStoreData(
        GOVERNANCE_BODY_ID,
        undefined,
        true,
      );

      // Check if there is v1, v2, v3 ..... and if not, then we assume this is a legacy governance table that isnt versioned
      const shouldSyncLegacy = !Object.keys(governanceData).some((key) =>
        /^v?[0-9]+$/.test(key),
      );

      if (shouldSyncLegacy) {
        logger.info(
          `using legacy V2 governance upsert method for governance store ${GOVERNANCE_BODY_ID}`,
        );
        await GovernanceV2.upsertGovernanceDownload(
          GOVERNANCE_BODY_ID,
          governanceData,
        );
      }

      // Check if the governance data for this version exists
      const dataModelVersion = getDataModelVersion();
      const versionedGovernanceStoreId = governanceData[dataModelVersion];
      if (versionedGovernanceStoreId) {
        logger.debug(
          `syncing V2 governance data from versioned store ${versionedGovernanceStoreId}`,
        );

        const versionedGovernanceData = await datalayer.getSubscribedStoreData(
          versionedGovernanceStoreId,
          undefined,
          true,
        );

        await GovernanceV2.upsertGovernanceDownload(
          versionedGovernanceStoreId,
          versionedGovernanceData,
        );
      } else {
        logger.warn(
          `No V2 governance data found for version ${dataModelVersion} in governance store ${GOVERNANCE_BODY_ID}`,
        );
      }
    } catch (error) {
      logger.error('Error syncing V2 governance data:', error);
      throw error;
    }
  }

  static async updateGoveranceBodyData(keyValueArray) {
    const governanceBodyId = await MetaV2.findOne({
      where: { metaKey: 'governanceBodyId' },
      raw: true,
    });

    if (!governanceBodyId) {
      throw new Error(
        'There is no V2 Governance Body that you own that can be edited',
      );
    }

    const existingRecords = await GovernanceV2.findAll({ raw: true });

    const changeList = [];

    await Promise.all(
      keyValueArray.map(async (keyValue) => {
        const valueExists = existingRecords.find(
          (record) => record.metaKey === keyValue.key,
        );

        await GovernanceV2.upsert({
          metaKey: keyValue.key,
          metaValue: keyValue.value,
          confirmed: false,
        });

        changeList.push(
          ...keyValueToChangeList(keyValue.key, keyValue.value, valueExists),
        );
      }),
    );

    const rollbackChangesIfFailed = async () => {
      logger.info('Reverting V2 Goverance Records');
      await GovernanceV2.destroy({
        where: {
          id: {
            [Sequelize.Op.ne]: null,
          },
        },
        truncate: true,
      });

      await Promise.all(
        existingRecords.map(async (record) => await GovernanceV2.upsert(record)),
      );
    };

    const onConfirm = async () => {
      await Promise.all(
        keyValueArray.map(async (keyValue) => {
          await GovernanceV2.upsert({
            metaKey: keyValue.key,
            metaValue: keyValue.value,
            confirmed: true,
          });
        }),
      );
    };

    await datalayer.pushDataLayerChangeList(
      governanceBodyId.metaValue,
      changeList,
    );

    datalayer.getStoreData(
      governanceBodyId.metaValue,
      onConfirm,
      rollbackChangesIfFailed,
    );
  }
}

GovernanceV2.init(ModelTypes, {
  sequelize: getSequelizeV2(),
  modelName: 'governance',
  timestamps: true,
  timezone: '+00:00',
  useHooks: true,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: true,
    typeCast: true,
  },
});

export { GovernanceV2 };
