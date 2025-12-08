'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class LabelV2Mirror extends Model {}

LabelV2Mirror.init(
  {
    cadTrustLabelId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_label_id',
      defaultValue: Sequelize.UUIDV4,
    },
    labelName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'label_name',
    },
    labelType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'label_type',
    },
    labelLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'label_link',
    },
    labelDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'label_date',
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
    modelName: 'LabelV2Mirror',
    tableName: 'label',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { LabelV2Mirror };
