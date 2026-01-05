'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class VerificationV2Mirror extends Model {
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

VerificationV2Mirror.init(
  {
    cadTrustVerificationId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_verification_id',
    },
    verificationId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'verification_id',
    },
    verificationStartDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'verification_start_date',
    },
    verificationEndDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'verification_end_date',
    },
    verificationBody: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'verification_body',
    },
    cadTrustProjectId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'cad_trust_project_id',
    },
    cadTrustValidationId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'cad_trust_validation_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'VerificationV2Mirror',
    tableName: 'verification_mirror',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { VerificationV2Mirror };
