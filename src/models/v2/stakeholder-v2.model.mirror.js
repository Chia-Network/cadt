'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class StakeholderV2Mirror extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }
}

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
    sequelize: sequelizeV2,
    modelName: 'StakeholderV2Mirror',
    tableName: 'stakeholder',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { StakeholderV2Mirror };
