'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class ProjectV2 extends Model {
  static associate(models) {
    // Project belongs to Program
    ProjectV2.belongsTo(models.ProgramV2, {
      foreignKey: 'cadTrustProgramId',
      as: 'program',
    });

    // Project has many Locations
    ProjectV2.hasMany(models.LocationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'locations',
    });

    // Note: Other associations will be added when those models are implemented
    // - Project has many Validations
    // - Project has many Verifications
    // - Project has many Estimations
    // - Project has many Ratings
    // - Project has many CoBenefits
  }
}

ProjectV2.init(
  {
    cadTrustProjectId: {
      type: Sequelize.STRING(36),
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_project_id',
      defaultValue: Sequelize.UUIDV4,
    },
    projectRegistryName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_registry_name',
    },
    projectId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_id',
    },
    projectCreditingProgram: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_crediting_program',
    },
    projectName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_name',
    },
    projectLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_link',
    },
    projectDescription: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_description',
    },
    projectSector: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_sector',
    },
    projectType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_type',
    },
    projectSubtype: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_subtype',
    },
    projectStatus: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_status',
    },
    projectStatusDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'project_status_date',
    },
    projectUnitMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_unit_metric',
    },
    cadTrustReferenceProjectId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'cad_trust_reference_project_id',
    },
    cadTrustProgramId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_program_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProjectV2',
    tableName: 'project',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ProjectV2 };
