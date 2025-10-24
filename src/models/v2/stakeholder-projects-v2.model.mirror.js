'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class StakeholderProjectV2Mirror extends Model {}

StakeholderProjectV2Mirror.init(
  {
    cadTrustStakeholderProjectId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_stakeholder_project_id',
      defaultValue: Sequelize.UUIDV4,
    },
    cadTrustStakeholderId: {
      type: Sequelize.UUID,
      allowNull: false,
      field: 'cad_trust_stakeholder_id',
    },
    cadTrustProjectId: {
      type: Sequelize.UUID,
      allowNull: false,
      field: 'cad_trust_project_id',
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
    modelName: 'StakeholderProjectV2Mirror',
    tableName: 'stakeholder_projects',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { StakeholderProjectV2Mirror };
