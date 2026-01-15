'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class ProjectV2Mirror extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static associate(models) {
    // Mirror associations if needed
  }
}

ProjectV2Mirror.init(
  {
    cadTrustProjectId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_project_id',
    },
    orgUid: {
      type: Sequelize.STRING(64),
      allowNull: false,
      field: 'org_uid',
      comment: 'Organization UID - identifies which organization owns this project. Automatically set from home organization.',
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
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_type',
      // Stored as JSON string in DB, returned as array to API
      get() {
        const rawValue = this.getDataValue('projectType');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          // If it's not valid JSON, return as single-item array for backwards compatibility
          return [rawValue];
        }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('projectType', null);
        } else if (Array.isArray(value)) {
          this.setDataValue('projectType', JSON.stringify(value));
        } else {
          // If a string is passed, wrap it in an array
          this.setDataValue('projectType', JSON.stringify([value]));
        }
      },
    },
    projectSubtype: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_subtype',
    },
    projectStatus: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_status',
      // Stored as JSON string in DB, returned as array to API
      get() {
        const rawValue = this.getDataValue('projectStatus');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          // If it's not valid JSON, return as single-item array for backwards compatibility
          return [rawValue];
        }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('projectStatus', null);
        } else if (Array.isArray(value)) {
          this.setDataValue('projectStatus', JSON.stringify(value));
        } else {
          // If a string is passed, wrap it in an array
          this.setDataValue('projectStatus', JSON.stringify([value]));
        }
      },
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
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'cad_trust_program_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProjectV2Mirror',
    tableName: 'project_mirror',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ProjectV2Mirror };
