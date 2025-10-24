'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class IssuanceV2 extends Model {
  static associate(models) {
    // Issuance belongs to Verification
    IssuanceV2.belongsTo(models.VerificationV2, {
      foreignKey: 'cadTrustVerificationId',
      as: 'verification',
    });

    // Issuance belongs to Methodology
    IssuanceV2.belongsTo(models.MethodologyV2, {
      foreignKey: 'cadTrustMethodologyId',
      as: 'methodology',
    });

    // Note: LocationV2 association will be added when Location endpoint is implemented
    // Issuance belongs to Location (optional)
    // IssuanceV2.belongsTo(models.LocationV2, {
    //   foreignKey: 'cadTrustLocationId',
    //   as: 'location',
    // });

    // Note: Other associations will be added when those models are implemented
    // - Issuance has many Units
  }
}

IssuanceV2.init(
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
    cadTrustMethodologyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'cad_trust_methodology_id',
    },
    cadTrustLocationId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_location_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'IssuanceV2',
    tableName: 'issuance',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { IssuanceV2 };
