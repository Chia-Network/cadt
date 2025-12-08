'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class UnitLabelV2Mirror extends Model {}

UnitLabelV2Mirror.init(
  {
    id: {
      type: Sequelize.VIRTUAL,
      get() {
        return `${this.cadTrustLabelId}-${this.cadTrustUnitId}`;
      },
    },
    cadTrustLabelId: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'cad_trust_label_id',
    },
    cadTrustUnitId: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
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
    modelName: 'UnitLabelV2Mirror',
    tableName: 'unit_label',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    // Define composite primary key
    primaryKey: ['cadTrustLabelId', 'cadTrustUnitId'],
  }
);

export { UnitLabelV2Mirror };
