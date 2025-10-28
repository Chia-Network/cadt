import { Sequelize, QueryTypes } from 'sequelize';
import config from '../../config/config.js';
import { logger } from '../../config/logger.js';
import mysql from 'mysql2/promise';
import { getConfig } from '../../utils/config-loader';

import { migrations } from './migrations';
import { seeders } from './seeders';

import dotenv from 'dotenv';
dotenv.config();

export const sequelizeV2 = new Sequelize(config[process.env.NODE_ENV ? `v2${process.env.NODE_ENV.charAt(0).toUpperCase() + process.env.NODE_ENV.slice(1)}` : 'v2Local']);

const mirrorConfig =
  (process.env.NODE_ENV || 'local') === 'local' ? 'v2Mirror' : 'v2MirrorTest';

export const sequelizeV2Mirror = new Sequelize(config[mirrorConfig]);

export const mirrorDBEnabledV2 = () => {
  const CONFIG = getConfig();
  if (
    mirrorConfig === 'v2Mirror' &&
    (!CONFIG?.MIRROR_DB?.DB_HOST ||
      !CONFIG?.MIRROR_DB?.DB_NAME ||
      !CONFIG?.MIRROR_DB?.DB_USERNAME ||
      !CONFIG?.MIRROR_DB?.DB_PASSWORD)
  ) {
    return false;
  }

  return true;
};

export const safeMirrorDbHandlerV2 = (callback) => {
  if (!mirrorDBEnabledV2()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      sequelizeV2Mirror
        .authenticate()
        .then(async () => {
          try {
            await callback();
          } catch (e) {
            logger.error(`v2_mirror_error:${e.message}`);
          }
        })
        .catch(() => {
          logger.info('V2 Mirror DB not connected');
        });
    } catch (error) {
      logger.error(
        'V2 MirrorDB tried to update before it was initialize, will try again later',
        error,
      );
    } finally {
      resolve();
    }
  });
};

export const seedV2Db = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    for (let i = 0; i < seeders.length; i++) {
      const seeder = seeders[i];
      logger.info(`SEEDING V2: ${seeder.name}`, seeder);
      await seeder.seed.up(queryInterface, Sequelize);
    }
  } catch (error) {
    logger.error('Error seeding V2 data', error);
  }
};

export const checkForV2Migrations = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    await queryInterface.createTable('SequelizeMetaV2', {
      name: Sequelize.STRING,
    });

    const completedMigrations = await db.query(
      'SELECT * FROM `SequelizeMetaV2`',
      {
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const notCompletedMigrations = migrations.filter((migration) => {
      return !completedMigrations
        .map((complete) => complete.name)
        .includes(migration.name);
    });

    for (let i = 0; i < notCompletedMigrations.length; i++) {
      try {
        const notCompleted = notCompletedMigrations[i];
        logger.info(`V2 MIGRATING: ${notCompleted.name}`);
        await notCompleted.migration.up(db.queryInterface, Sequelize);
        await db.query('INSERT INTO `SequelizeMetaV2` VALUES(:name)', {
          type: Sequelize.QueryTypes.INSERT,
          replacements: { name: notCompleted.name },
        });
      } catch (e) {
        logger.error('V2 Migration not completed', e);
      }
    }
  } catch (error) {
    logger.error('Error checking for V2 migrations', error);
  }
};

export const prepareV2Db = async () => {
  const mirrorConfig =
    (process.env.NODE_ENV || 'local') === 'local' ? 'v2Mirror' : 'v2MirrorTest';

  if (
    mirrorConfig == 'v2Mirror' &&
    getConfig().MIRROR_DB.DB_HOST &&
    getConfig().MIRROR_DB.DB_HOST !== ''
  ) {
    const connection = await mysql.createConnection({
      host: getConfig().MIRROR_DB.DB_HOST,
      port: 3306,
      user: getConfig().MIRROR_DB.DB_USERNAME,
      password: getConfig().MIRROR_DB.DB_PASSWORD,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${getConfig().MIRROR_DB.DB_NAME}_v2\`;`,
    );

    // Use the exported sequelizeV2Mirror instance instead of creating a new one
    await checkForV2Migrations(sequelizeV2Mirror);
  } else if (mirrorConfig == 'v2MirrorTest') {
    await checkForV2Migrations(sequelizeV2Mirror);
  }

  await checkForV2Migrations(sequelizeV2);
};

async function setV2WALMode() {
  try {
    await sequelizeV2.authenticate();
    await sequelizeV2.query('PRAGMA journal_mode=WAL;', { type: QueryTypes.RAW });
    console.log('V2 WAL mode set successfully.');
  } catch (error) {
    console.error('Unable to set V2 WAL mode:', error);
  }
}

setV2WALMode();
