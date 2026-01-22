'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class IssuanceV2Mirror extends Model {
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

IssuanceV2Mirror.init(
  {
    cadTrustIssuanceId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_issuance_id',
    },
    issuanceId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'issuance_id',
    },
    issuanceDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'issuance_date',
    },
    cadTrustVerificationId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'cad_trust_verification_id',
    },
    cadTrustProjectMethodologyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'cad_trust_project_methodology_id',
    },
    cadTrustLocationId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'cad_trust_location_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'IssuanceV2Mirror',
    tableName: 'issuance_mirror',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { IssuanceV2Mirror };
