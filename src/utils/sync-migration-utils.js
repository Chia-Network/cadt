import { Sequelize } from 'sequelize';
import { Organization, Audit, ModelKeys, Meta } from '../models';
import { logger } from '../config/logger.cjs';
import datalayer from '../datalayer';
import { sequelize } from '../database';

export const migrateToNewSync = async () => {
  logger.info(
    'Initiating migration to the new synchronization method. This will require a complete resynchronization of all data and may take some time.',
  );

  for (const modelKey of Object.keys(ModelKeys)) {
    logger.info(`Resetting ${modelKey}`);
    await ModelKeys[modelKey].destroy({
      where: {
        id: {
          [Sequelize.Op.ne]: null,
        },
      },
      truncate: true,
    });
  }

  logger.info(`Resetting Audit Table`);
  await Audit.destroy({
    where: {
      id: {
        [Sequelize.Op.ne]: null,
      },
    },
    truncate: true,
  });

  await Meta.upsert({
    metaKey: 'migratedToNewSync',
    metaValue: 'true',
  });

  await Organization.update(
    {
      synced: false,
      sync_remaining: 0,
    },
    {
      where: {
        id: {
          [Sequelize.Op.ne]: null,
        },
      },
    },
  );

  logger.info(`Migration Complete`);
};

export const generateGenerationIndex = async () => {
  logger.debug('generating generation index');
  logger.debug('querying organization model');
  const organizations = await Organization.findAll({
    where: { subscribed: true },
    raw: true,
  });

  for (const organization of organizations) {
    logger.debug(
      `querying datalayer to get root history of store ${organization.name}`,
    );
    const rootHistory = await datalayer.getRootHistory(organization.registryId);

    for (let i = 0; i < rootHistory.length; i++) {
      // Find the oldest timestamp with a null value
      logger.debug(
        `querying audit table for ${organization.name} generaton #${i}`,
      );
      const oldestNullGenerations = await Audit.findAll({
        where: {
          registryId: organization.registryId,
          generation: null,
        },
        group: 'onChainConfirmationTimeStamp',
        order: [
          [
            sequelize.fn('MIN', sequelize.col('onChainConfirmationTimeStamp')),
            'ASC',
          ],
        ],
        limit: 1,
        raw: true,
      });

      const oldestNullGeneration = oldestNullGenerations[0];

      if (!oldestNullGeneration) {
        continue;
      }

      logger.info(`Syncing ${organization.name} generation ${i}`);
      await Audit.update(
        {
          generation: i,
        },
        {
          where: {
            registryId: organization.registryId,
            onchainConfirmationTimeStamp:
              oldestNullGeneration.onchainConfirmationTimeStamp,
          },
        },
      );
    }
  }

  await Meta.upsert({
    metaKey: 'migratedToIndexBasedSync',
    metaValue: 'true',
  });
};
