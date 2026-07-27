'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class IssuanceV2Mirror extends Model {}

initMirrorModelV2(() => {
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
        type: Sequelize.STRING(36),
        allowNull: false,
        field: 'cad_trust_verification_id',
      },
      cadTrustProjectMethodologyId: {
        type: Sequelize.STRING(36),
        allowNull: false,
        field: 'cad_trust_project_methodology_id',
      },
      cadTrustLocationId: {
        type: Sequelize.STRING(36),
        allowNull: true,
        field: 'cad_trust_location_id',
      },
      createdByOrgUid: {
        type: Sequelize.STRING(64),
        allowNull: true,
        field: 'created_by_org_uid',
      },
    },
    {
      sequelize: sequelizeV2Mirror,
      modelName: 'IssuanceV2Mirror',
      tableName: 'issuance',
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

export { IssuanceV2Mirror };
