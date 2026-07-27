'use strict';

import { Sequelize, Model } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class UnitLabelV2Mirror extends Model {}

initMirrorModelV2(() => {
  UnitLabelV2Mirror.init(
    {
      cadTrustUnitLabelId: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
        field: 'cad_trust_unit_label_id',
        defaultValue: () => uuidv4(),
      },
      cadTrustLabelId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'cad_trust_label_id',
      },
      cadTrustUnitId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'cad_trust_unit_id',
      },
      labelUnitDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        field: 'label_unit_date',
      },
      labelUnitDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'label_unit_description',
      },
      createdByOrgUid: {
        type: Sequelize.STRING(64),
        allowNull: true,
        field: 'created_by_org_uid',
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
      modelName: 'UnitLabelV2Mirror',
      tableName: 'unit_label',
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

export { UnitLabelV2Mirror };
