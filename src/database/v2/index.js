import _ from 'lodash';
import { Sequelize, QueryTypes } from 'sequelize';
import mysql from 'mysql2/promise';
import config from '../../config/config.js';
import { logger } from '../../config/logger.js';
import { getConfig } from '../../utils/config-loader.js';
import { getV2Config } from '../../utils/v2-config-loader.js';

import { migrations } from './migrations/index.js';

import dotenv from 'dotenv';
dotenv.config();

// V2 Database instance - initialize lazily to avoid circular dependency
let sequelizeV2 = null;
let sequelizeV2Mirror = null;

const getSequelizeV2 = () => {
  if (!sequelizeV2) {
    sequelizeV2 = new Sequelize(config[process.env.NODE_ENV === 'test' ? 'v2Test' : 'v2']);
  }
  return sequelizeV2;
};

const getSequelizeV2Mirror = () => {
  if (!sequelizeV2Mirror) {
    const mirrorConfig = (process.env.NODE_ENV || 'local') === 'local' ? 'v2Mirror' : 'v2MirrorTest';
    sequelizeV2Mirror = new Sequelize(config[mirrorConfig]);
  }
  return sequelizeV2Mirror;
};

// Safe mirror database handler for V2
export const safeMirrorDbHandler = (callback) => {
  try {
    const v2Config = getV2Config();
    if (v2Config.MIRROR_DB.DB_HOST && v2Config.MIRROR_DB.DB_HOST !== '') {
      callback();
    }
  } catch (error) {
    logger.error('V2 Mirror DB handler error:', error);
  }
};

const logDebounce = _.debounce(() => {
  console.log('V2 Database not connected');
  logger.info('V2 Database not connected');
}, 120000);

export const checkForV2Migrations = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    await queryInterface.createTable('SequelizeMeta', {
      name: Sequelize.STRING,
    });

    const completedMigrations = await db.query(
      'SELECT * FROM `SequelizeMeta`',
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
        await db.query('INSERT INTO `SequelizeMeta` VALUES(:name)', {
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
  const mirrorConfig = (process.env.NODE_ENV || 'local') === 'local' ? 'v2Mirror' : 'v2MirrorTest';

  // Check for collision prevention
  if (mirrorConfig === 'v2Mirror') {
    const v1Config = getConfig();
    const v2Config = getV2Config();

    // Check if both v1 and v2 are using MySQL mirroring
    if (v1Config.MIRROR_DB.DB_HOST && v1Config.MIRROR_DB.DB_HOST !== '' &&
        v2Config.MIRROR_DB.DB_HOST && v2Config.MIRROR_DB.DB_HOST !== '') {

      // Check if DB_NAME is the same (unless both are null/empty)
      if (v1Config.MIRROR_DB.DB_NAME && v2Config.MIRROR_DB.DB_NAME &&
          v1Config.MIRROR_DB.DB_NAME === v2Config.MIRROR_DB.DB_NAME) {
        logger.error('V2 Mirror DB Error: V1 and V2 cannot use the same DB_NAME to prevent data collision');
        throw new Error('V1 and V2 mirror databases cannot use the same DB_NAME');
      }
    }
  }

  if (
    mirrorConfig === 'v2Mirror' &&
    getV2Config().MIRROR_DB.DB_HOST &&
    getV2Config().MIRROR_DB.DB_HOST !== ''
  ) {
    const connection = await mysql.createConnection({
      host: getV2Config().MIRROR_DB.DB_HOST,
      port: 3306,
      user: getV2Config().MIRROR_DB.DB_USERNAME,
      password: getV2Config().MIRROR_DB.DB_PASSWORD,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${getV2Config().MIRROR_DB.DB_NAME}\`;`,
    );

    const db = new Sequelize(config[mirrorConfig]);

    await checkForV2Migrations(db);
  } else if (mirrorConfig === 'v2MirrorTest') {
    await checkForV2Migrations(getSequelizeV2Mirror());
  }

  try {
    const db = getSequelizeV2();
    await checkForV2Migrations(db);

    // Initialize models and associations
    await initializeV2Models();

    logger.info('V2 Database prepared successfully');
  } catch (error) {
    logger.error('Error preparing V2 database', error);
  }
};

// Function to set WAL mode for V2 database
async function setV2WALMode() {
  try {
    const db = getSequelizeV2();
    await db.authenticate();
    await db.query('PRAGMA journal_mode=WAL;', { type: QueryTypes.RAW });
    console.log('V2 Database WAL mode set successfully.');
  } catch (error) {
    console.error('Unable to set V2 database WAL mode:', error);
  }
}

// Initialize V2 models and associations
const initializeV2Models = async () => {
  try {
    // Import all V2 models - this will trigger their initialization
    await import('../../models/v2/index.js');

    // Wait a bit for models to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now import the models again to get the initialized instances
    const {
      StagingV2,
      OrganizationsV2,
      MetaV2,
      GovernanceV2,
      SimulatorV2,
      AuditV2,
      ProjectV2Mirror,
      ValidationV2Mirror,
      VerificationV2,
      MethodologyV2,
      LocationV2,
      IssuanceV2Mirror,
      UnitV2Mirror
    } = await import('../../models/v2/index.js');

    // Set up model associations only if models are properly initialized
    if (ProjectV2Mirror && ProjectV2Mirror.sequelize) {
      // Project has many validations
      if (ValidationV2Mirror && ValidationV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(ValidationV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'validations'
        });

        ValidationV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many verifications
      if (VerificationV2 && VerificationV2.sequelize) {
        ProjectV2Mirror.hasMany(VerificationV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'verifications'
        });

        VerificationV2.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many locations
      if (LocationV2 && LocationV2.sequelize) {
        ProjectV2Mirror.hasMany(LocationV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'locations'
        });

        LocationV2.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many issuances
      if (IssuanceV2Mirror && IssuanceV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(IssuanceV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'issuances'
        });

        IssuanceV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }
    }

    // Unit belongs to issuance
    if (UnitV2Mirror && UnitV2Mirror.sequelize && IssuanceV2Mirror && IssuanceV2Mirror.sequelize) {
      UnitV2Mirror.belongsTo(IssuanceV2Mirror, {
        foreignKey: 'cadTrustIssuanceId',
        as: 'issuance'
      });

      IssuanceV2Mirror.hasMany(UnitV2Mirror, {
        foreignKey: 'cadTrustIssuanceId',
        as: 'units'
      });
    }

    logger.info('V2 models initialized with associations');
  } catch (error) {
    logger.error('Error initializing V2 models:', error);
  }
};

// Export the getter functions for external use
export { getSequelizeV2 as sequelizeV2, getSequelizeV2Mirror as sequelizeV2Mirror, initializeV2Models };
