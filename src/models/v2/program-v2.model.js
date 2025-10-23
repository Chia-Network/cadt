'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class ProgramV2 extends Model {
  static associate(models) {
    // Program has many Projects
    ProgramV2.hasMany(models.ProjectV2, {
      foreignKey: 'cadTrustProgramId',
      as: 'projects',
    });
  }
}

ProgramV2.init(
  {
    cadTrustProgramId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      field: 'cad_trust_program_id',
    },
    programName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'program_name',
    },
    programRegistry: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'program_registry',
    },
    programRegistryActivityId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'program_registry_activity_id',
    },
    programRegistryProgramId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'program_registry_program_id',
    },
    programDescription: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'program_description',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProgramV2',
    tableName: 'program',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ProgramV2 };
