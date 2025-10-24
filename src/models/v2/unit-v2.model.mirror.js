'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class UnitV2Mirror extends Model {
  static associate(models) {
    // Mirror associations if needed
  }
}

UnitV2Mirror.init(
  {
    cadTrustUnitId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_unit_id',
    },
    unitSerialId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_serial_id',
    },
    unitStartBlock: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_start_block',
    },
    unitEndBlock: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_end_block',
    },
    unitCount: {
      type: Sequelize.DECIMAL,
      allowNull: true,
      field: 'unit_count',
    },
    unitType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_type',
    },
    unitVintageYear: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'unit_vintage_year',
    },
    unitStatus: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_status',
    },
    unitStatusReason: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_status_reason',
    },
    unitStatusDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'unit_status_date',
    },
    unitRetirementDetail: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_retirement_detail',
    },
    unitRetirementBeneficiary: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_retirement_beneficiary',
    },
    unitRetirementBeneficiaryId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_retirement_beneficiary_id',
    },
    unitLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_link',
    },
    unitMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_metric',
    },
    unitCurrentOwner: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_current_owner',
    },
    unitItmosReferenceId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_itmos_reference_id',
    },
    cadTrustIssuanceId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'cad_trust_issuance_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'UnitV2Mirror',
    tableName: 'unit_mirror',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { UnitV2Mirror };
