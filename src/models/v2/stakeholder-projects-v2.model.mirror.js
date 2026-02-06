'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';

class StakeholderProjectV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
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
      sequelize: sequelizeV2Mirror,
      modelName: 'StakeholderProjectV2Mirror',
      tableName: 'stakeholder_projects',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      timezone: '+00:00',
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
      dialectOptions: {
        charset: 'utf8mb4',
        dateStrings: true,
        typeCast: true,
      },
    }
  );
});

export { StakeholderProjectV2Mirror };
