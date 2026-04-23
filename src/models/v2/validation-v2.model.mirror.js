'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class ValidationV2Mirror extends Model {}

initMirrorModelV2(() => {
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
      sequelize: sequelizeV2Mirror,
      modelName: 'ValidationV2Mirror',
      tableName: 'validation',
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

export { ValidationV2Mirror };
