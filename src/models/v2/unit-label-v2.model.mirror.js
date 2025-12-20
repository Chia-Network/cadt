'use strict';

import { Sequelize, Model } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelizeV2 } from '../../database/v2/index.js';

class UnitLabelV2Mirror extends Model {}

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
  }
);

export { UnitLabelV2Mirror };
