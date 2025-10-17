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
      // System Models
      StagingV2,
      OrganizationsV2,
      MetaV2,
      GovernanceV2,
      SimulatorV2,
      AuditV2,

      // Data Models (Main)
      ProjectV2,
      ValidationV2,
      VerificationV2,
      IssuanceV2,
      UnitV2,
      MethodologyV2,
      ProjectMethodologyV2,
      LocationV2,
      StakeholderV2,
      StakeholderProjectsV2,
      LabelV2,
      UnitLabelV2,
      CoBenefitV2,
      EstimationV2,
      RatingV2,
      ProgramV2,
      AefT1SubmissionV2,
      AefT2AuthorizationsV2,
      AefT3ActionsV2,
      AefT4HoldingsV2,
      AefT5AuthorizedEntitiesV2,

      // Data Models (Mirror)
      ProjectV2Mirror,
      ValidationV2Mirror,
      VerificationV2Mirror,
      IssuanceV2Mirror,
      UnitV2Mirror,
      MethodologyV2Mirror,
      ProjectMethodologyV2Mirror,
      LocationV2Mirror,
      StakeholderV2Mirror,
      StakeholderProjectsV2Mirror,
      LabelV2Mirror,
      UnitLabelV2Mirror,
      CoBenefitV2Mirror,
      EstimationV2Mirror,
      RatingV2Mirror,
      ProgramV2Mirror,
      AefT1SubmissionV2Mirror,
      AefT2AuthorizationsV2Mirror,
      AefT3ActionsV2Mirror,
      AefT4HoldingsV2Mirror,
      AefT5AuthorizedEntitiesV2Mirror,
      AuditV2Mirror
    } = await import('../../models/v2/index.js');

    // Set up model associations for MAIN models
    if (ProjectV2 && ProjectV2.sequelize) {
      // Project has many validations
      if (ValidationV2 && ValidationV2.sequelize) {
        ProjectV2.hasMany(ValidationV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'validations'
        });
        ValidationV2.belongsTo(ProjectV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many verifications
      if (VerificationV2 && VerificationV2.sequelize) {
        ProjectV2.hasMany(VerificationV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'verifications'
        });
        VerificationV2.belongsTo(ProjectV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many locations
      if (LocationV2 && LocationV2.sequelize) {
        ProjectV2.hasMany(LocationV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'locations'
        });
        LocationV2.belongsTo(ProjectV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many issuances - NOTE: Issuance is related through verification, not directly to project
      // Remove this incorrect association

      // Project has many stakeholders (through stakeholder-projects)
      if (StakeholderProjectsV2 && StakeholderProjectsV2.sequelize) {
        ProjectV2.hasMany(StakeholderProjectsV2, {
          foreignKey: 'cad_trust_project_id',
          as: 'stakeholderProjects'
        });
        StakeholderProjectsV2.belongsTo(ProjectV2, {
          foreignKey: 'cad_trust_project_id',
          as: 'project'
        });
      }

      // Project has many methodologies (through project-methodology)
      if (ProjectMethodologyV2 && ProjectMethodologyV2.sequelize) {
        ProjectV2.hasMany(ProjectMethodologyV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'projectMethodologies'
        });
        ProjectMethodologyV2.belongsTo(ProjectV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many estimations
      if (EstimationV2 && EstimationV2.sequelize) {
        ProjectV2.hasMany(EstimationV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'estimations'
        });
        EstimationV2.belongsTo(ProjectV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many ratings
      if (RatingV2 && RatingV2.sequelize) {
        ProjectV2.hasMany(RatingV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'ratings'
        });
        RatingV2.belongsTo(ProjectV2, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Program is a standalone table - no direct association with Project
    }

    // Issuance has many units
    if (IssuanceV2 && IssuanceV2.sequelize && UnitV2 && UnitV2.sequelize) {
      IssuanceV2.hasMany(UnitV2, {
        foreignKey: 'cadTrustIssuanceId',
        as: 'units'
      });
      UnitV2.belongsTo(IssuanceV2, {
        foreignKey: 'cadTrustIssuanceId',
        as: 'issuance'
      });
    }

    // Unit has many unit-labels
    if (UnitV2 && UnitV2.sequelize && UnitLabelV2 && UnitLabelV2.sequelize) {
      UnitV2.hasMany(UnitLabelV2, {
        foreignKey: 'cadTrustUnitId',
        as: 'unitLabels'
      });
      UnitLabelV2.belongsTo(UnitV2, {
        foreignKey: 'cadTrustUnitId',
        as: 'unit'
      });
    }

    // Label has many unit-labels
    if (LabelV2 && LabelV2.sequelize && UnitLabelV2 && UnitLabelV2.sequelize) {
      LabelV2.hasMany(UnitLabelV2, {
        foreignKey: 'cadTrustLabelId',
        as: 'unitLabels'
      });
      UnitLabelV2.belongsTo(LabelV2, {
        foreignKey: 'cadTrustLabelId',
        as: 'label'
      });
    }

    // Stakeholder has many stakeholder-projects
    if (StakeholderV2 && StakeholderV2.sequelize && StakeholderProjectsV2 && StakeholderProjectsV2.sequelize) {
      StakeholderV2.hasMany(StakeholderProjectsV2, {
        foreignKey: 'cad_trust_stakeholder_id',
        as: 'stakeholderProjects'
      });
      StakeholderProjectsV2.belongsTo(StakeholderV2, {
        foreignKey: 'cad_trust_stakeholder_id',
        as: 'stakeholder'
      });
    }

    // Methodology has many project-methodologies
    if (MethodologyV2 && MethodologyV2.sequelize && ProjectMethodologyV2 && ProjectMethodologyV2.sequelize) {
      MethodologyV2.hasMany(ProjectMethodologyV2, {
        foreignKey: 'cadTrustMethodologyId',
        as: 'projectMethodologies'
      });
      ProjectMethodologyV2.belongsTo(MethodologyV2, {
        foreignKey: 'cadTrustMethodologyId',
        as: 'methodology'
      });
    }

    // AEF T1 Submission has many T2 Authorizations
    if (AefT1SubmissionV2 && AefT1SubmissionV2.sequelize && AefT2AuthorizationsV2 && AefT2AuthorizationsV2.sequelize) {
      AefT1SubmissionV2.hasMany(AefT2AuthorizationsV2, {
        foreignKey: 'cadTrustAefT1SubmissionId',
        as: 'authorizations'
      });
      AefT2AuthorizationsV2.belongsTo(AefT1SubmissionV2, {
        foreignKey: 'cadTrustAefT1SubmissionId',
        as: 'submission'
      });
    }

    // AEF T2 Authorizations has many T3 Actions
    if (AefT2AuthorizationsV2 && AefT2AuthorizationsV2.sequelize && AefT3ActionsV2 && AefT3ActionsV2.sequelize) {
      AefT2AuthorizationsV2.hasMany(AefT3ActionsV2, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'actions'
      });
      AefT3ActionsV2.belongsTo(AefT2AuthorizationsV2, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'authorization'
      });
    }

    // AEF T2 Authorizations has many T4 Holdings
    if (AefT2AuthorizationsV2 && AefT2AuthorizationsV2.sequelize && AefT4HoldingsV2 && AefT4HoldingsV2.sequelize) {
      AefT2AuthorizationsV2.hasMany(AefT4HoldingsV2, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'holdings'
      });
      AefT4HoldingsV2.belongsTo(AefT2AuthorizationsV2, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'authorization'
      });
    }

    // AEF T2 Authorizations belongs to T5 Authorized Entities
    if (AefT2AuthorizationsV2 && AefT2AuthorizationsV2.sequelize && AefT5AuthorizedEntitiesV2 && AefT5AuthorizedEntitiesV2.sequelize) {
      AefT2AuthorizationsV2.belongsTo(AefT5AuthorizedEntitiesV2, {
        foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
        as: 'authorizedEntity'
      });
      AefT5AuthorizedEntitiesV2.hasMany(AefT2AuthorizationsV2, {
        foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
        as: 'authorizations'
      });
    }

    // AEF T2 Authorizations belongs to Unit
    if (AefT2AuthorizationsV2 && AefT2AuthorizationsV2.sequelize && UnitV2 && UnitV2.sequelize) {
      AefT2AuthorizationsV2.belongsTo(UnitV2, {
        foreignKey: 'cadTrustUnitId',
        as: 'unit'
      });
      UnitV2.hasMany(AefT2AuthorizationsV2, {
        foreignKey: 'cadTrustUnitId',
        as: 'authorizations'
      });
    }

    // Set up MIRROR model associations (same structure as main models)
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
      if (VerificationV2Mirror && VerificationV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(VerificationV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'verifications'
        });
        VerificationV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many locations
      if (LocationV2Mirror && LocationV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(LocationV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'locations'
        });
        LocationV2Mirror.belongsTo(ProjectV2Mirror, {
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

      // Project has many stakeholders (through stakeholder-projects)
      if (StakeholderProjectsV2Mirror && StakeholderProjectsV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(StakeholderProjectsV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'stakeholderProjects'
        });
        StakeholderProjectsV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many methodologies (through project-methodology)
      if (ProjectMethodologyV2Mirror && ProjectMethodologyV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(ProjectMethodologyV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'projectMethodologies'
        });
        ProjectMethodologyV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many estimations
      if (EstimationV2Mirror && EstimationV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(EstimationV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'estimations'
        });
        EstimationV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Project has many ratings
      if (RatingV2Mirror && RatingV2Mirror.sequelize) {
        ProjectV2Mirror.hasMany(RatingV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'ratings'
        });
        RatingV2Mirror.belongsTo(ProjectV2Mirror, {
          foreignKey: 'cadTrustProjectId',
          as: 'project'
        });
      }

      // Program is a standalone table - no direct association with Project (mirror)
    }

    // Issuance has many units (mirror)
    if (IssuanceV2Mirror && IssuanceV2Mirror.sequelize && UnitV2Mirror && UnitV2Mirror.sequelize) {
      IssuanceV2Mirror.hasMany(UnitV2Mirror, {
        foreignKey: 'cadTrustIssuanceId',
        as: 'units'
      });
      UnitV2Mirror.belongsTo(IssuanceV2Mirror, {
        foreignKey: 'cadTrustIssuanceId',
        as: 'issuance'
      });
    }

    // Unit has many unit-labels (mirror)
    if (UnitV2Mirror && UnitV2Mirror.sequelize && UnitLabelV2Mirror && UnitLabelV2Mirror.sequelize) {
      UnitV2Mirror.hasMany(UnitLabelV2Mirror, {
        foreignKey: 'cadTrustUnitId',
        as: 'unitLabels'
      });
      UnitLabelV2Mirror.belongsTo(UnitV2Mirror, {
        foreignKey: 'cadTrustUnitId',
        as: 'unit'
      });
    }

    // Label has many unit-labels (mirror)
    if (LabelV2Mirror && LabelV2Mirror.sequelize && UnitLabelV2Mirror && UnitLabelV2Mirror.sequelize) {
      LabelV2Mirror.hasMany(UnitLabelV2Mirror, {
        foreignKey: 'cadTrustLabelId',
        as: 'unitLabels'
      });
      UnitLabelV2Mirror.belongsTo(LabelV2Mirror, {
        foreignKey: 'cadTrustLabelId',
        as: 'label'
      });
    }

    // Stakeholder has many stakeholder-projects (mirror)
    if (StakeholderV2Mirror && StakeholderV2Mirror.sequelize && StakeholderProjectsV2Mirror && StakeholderProjectsV2Mirror.sequelize) {
      StakeholderV2Mirror.hasMany(StakeholderProjectsV2Mirror, {
        foreignKey: 'cadTrustStakeholderId',
        as: 'stakeholderProjects'
      });
      StakeholderProjectsV2Mirror.belongsTo(StakeholderV2Mirror, {
        foreignKey: 'cadTrustStakeholderId',
        as: 'stakeholder'
      });
    }

    // Methodology has many project-methodologies (mirror)
    if (MethodologyV2Mirror && MethodologyV2Mirror.sequelize && ProjectMethodologyV2Mirror && ProjectMethodologyV2Mirror.sequelize) {
      MethodologyV2Mirror.hasMany(ProjectMethodologyV2Mirror, {
        foreignKey: 'cadTrustMethodologyId',
        as: 'projectMethodologies'
      });
      ProjectMethodologyV2Mirror.belongsTo(MethodologyV2Mirror, {
        foreignKey: 'cadTrustMethodologyId',
        as: 'methodology'
      });
    }

    // AEF associations (mirror) - same structure as main models
    if (AefT1SubmissionV2Mirror && AefT1SubmissionV2Mirror.sequelize && AefT2AuthorizationsV2Mirror && AefT2AuthorizationsV2Mirror.sequelize) {
      AefT1SubmissionV2Mirror.hasMany(AefT2AuthorizationsV2Mirror, {
        foreignKey: 'cadTrustAefT1SubmissionId',
        as: 'authorizations'
      });
      AefT2AuthorizationsV2Mirror.belongsTo(AefT1SubmissionV2Mirror, {
        foreignKey: 'cadTrustAefT1SubmissionId',
        as: 'submission'
      });
    }

    if (AefT2AuthorizationsV2Mirror && AefT2AuthorizationsV2Mirror.sequelize && AefT3ActionsV2Mirror && AefT3ActionsV2Mirror.sequelize) {
      AefT2AuthorizationsV2Mirror.hasMany(AefT3ActionsV2Mirror, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'actions'
      });
      AefT3ActionsV2Mirror.belongsTo(AefT2AuthorizationsV2Mirror, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'authorization'
      });
    }

    if (AefT2AuthorizationsV2Mirror && AefT2AuthorizationsV2Mirror.sequelize && AefT4HoldingsV2Mirror && AefT4HoldingsV2Mirror.sequelize) {
      AefT2AuthorizationsV2Mirror.hasMany(AefT4HoldingsV2Mirror, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'holdings'
      });
      AefT4HoldingsV2Mirror.belongsTo(AefT2AuthorizationsV2Mirror, {
        foreignKey: 'cadTrustAefT2AuthorizationsId',
        as: 'authorization'
      });
    }

    if (AefT2AuthorizationsV2Mirror && AefT2AuthorizationsV2Mirror.sequelize && AefT5AuthorizedEntitiesV2Mirror && AefT5AuthorizedEntitiesV2Mirror.sequelize) {
      AefT2AuthorizationsV2Mirror.belongsTo(AefT5AuthorizedEntitiesV2Mirror, {
        foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
        as: 'authorizedEntity'
      });
      AefT5AuthorizedEntitiesV2Mirror.hasMany(AefT2AuthorizationsV2Mirror, {
        foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
        as: 'authorizations'
      });
    }

    if (AefT2AuthorizationsV2Mirror && AefT2AuthorizationsV2Mirror.sequelize && UnitV2Mirror && UnitV2Mirror.sequelize) {
      AefT2AuthorizationsV2Mirror.belongsTo(UnitV2Mirror, {
        foreignKey: 'cadTrustUnitId',
        as: 'unit'
      });
      UnitV2Mirror.hasMany(AefT2AuthorizationsV2Mirror, {
        foreignKey: 'cadTrustUnitId',
        as: 'authorizations'
      });
    }

    logger.info('V2 models initialized with complete associations (main and mirror)');
  } catch (error) {
    logger.error('Error initializing V2 models:', error);
  }
};

// Export the getter functions for external use
export { getSequelizeV2 as sequelizeV2, getSequelizeV2Mirror as sequelizeV2Mirror, initializeV2Models };
