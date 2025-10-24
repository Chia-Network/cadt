'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class ValidationV2 extends Model {
  static associate(models) {
    // Validation belongs to Project
    ValidationV2.belongsTo(models.ProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'project',
    });

    // Note: Other associations will be added when those models are implemented
    // - Validation has many Verifications
  }
}

ValidationV2.init(
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
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_project_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ValidationV2',
    tableName: 'validation',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ValidationV2 };
