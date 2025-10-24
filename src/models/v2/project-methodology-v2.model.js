'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './project-methodology-v2.modeltypes.cjs';

class ProjectMethodologyV2 extends Model {}

ProjectMethodologyV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'ProjectMethodologyV2',
  tableName: 'project_methodolgy',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  // Define composite primary key
  primaryKey: ['cadTrustProjectId', 'cadTrustMethodologyId'],
});

// Define associations
ProjectMethodologyV2.associate = (models) => {
  // Project-Methodology belongs to Project
  ProjectMethodologyV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // Project-Methodology belongs to Methodology
  ProjectMethodologyV2.belongsTo(models.MethodologyV2, {
    foreignKey: 'cadTrustMethodologyId',
    as: 'methodology',
  });
};

export { ProjectMethodologyV2 };
