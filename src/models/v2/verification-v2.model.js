'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class VerificationV2 extends Model {
  static associate(models) {
    // Verification belongs to Project
    VerificationV2.belongsTo(models.ProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'project',
    });

    // Verification belongs to Validation
    VerificationV2.belongsTo(models.ValidationV2, {
      foreignKey: 'cadTrustValidationId',
      as: 'validation',
    });

    // Note: Other associations will be added when those models are implemented
    // - Verification has many Issuances
  }
}

VerificationV2.init(
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
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_project_id',
    },
    cadTrustValidationId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_validation_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'VerificationV2',
    tableName: 'verification',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { VerificationV2 };
