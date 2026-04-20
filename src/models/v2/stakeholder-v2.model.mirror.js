'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class StakeholderV2Mirror extends Model {}

initMirrorModelV2(() => {
  StakeholderV2Mirror.init(
    {
      cadTrustStakeholderId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        field: 'cad_trust_stakeholder_id',
        defaultValue: Sequelize.UUIDV4,
      },
      stakeholderName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'stakeholder_name',
      },
      stakeholderType: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'stakeholder_type',
      },
      stakeholderLink: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'stakeholder_link',
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
      modelName: 'StakeholderV2Mirror',
      tableName: 'stakeholder',
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

export { StakeholderV2Mirror };
