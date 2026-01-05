'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class ValidationV2Mirror extends Model {
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

  static associate(models) {
    // Mirror associations if needed
  }
}

ValidationV2Mirror.init(
  {
    cadTrustValidationId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_validation_id',
    },
    validationId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'validation_id',
    },
    validationType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'validation_type',
    },
    validationBody: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'validation_body',
    },
    validationDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'validation_date',
    },
    validationCreditPeriodStartDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'validation_credit_period_start_date',
    },
    validationCreditPeriodEndDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'validation_credit_period_end_date',
    },
    cadTrustProjectId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'cad_trust_project_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ValidationV2Mirror',
    tableName: 'validation_mirror',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ValidationV2Mirror };
