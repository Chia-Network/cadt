'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class ProjectMethodologyV2Mirror extends Model {}

ProjectMethodologyV2Mirror.init(
  {
    id: {
      type: Sequelize.VIRTUAL,
      get() {
        return `${this.cadTrustProjectId}-${this.cadTrustMethodologyId}`;
      },
    },
    cadTrustProjectId: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'cad_trust_project_id',
    },
    cadTrustMethodologyId: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'cad_trust_methodology_id',
    },
    projectMethodologyDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'project_methodology_date',
    },
    projectMethodologyDescription: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_methodology_description',
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: Sequelize.NOW,
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProjectMethodologyV2Mirror',
    tableName: 'project_methodolgy',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    // Define composite primary key
    primaryKey: ['cadTrustProjectId', 'cadTrustMethodologyId'],
  }
);

export { ProjectMethodologyV2Mirror };
