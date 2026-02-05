'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';

class VerificationV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
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
      sequelize: sequelizeV2Mirror,
      modelName: 'VerificationV2Mirror',
      tableName: 'verification',
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

export { VerificationV2Mirror };
