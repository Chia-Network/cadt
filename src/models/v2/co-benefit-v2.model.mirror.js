'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class CoBenefitV2Mirror extends Model {}

CoBenefitV2Mirror.init(
  {
    cadTrustCoBenefitId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_co_benefit_id',
      defaultValue: Sequelize.UUIDV4,
    },
    coBenefitId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'co_benefit_id',
    },
    cadTrustProjectId: {
      type: Sequelize.UUID,
      allowNull: false,
      field: 'cad_trust_project_id',
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: Sequelize.NOW,
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'CoBenefitV2Mirror',
    tableName: 'co_benefit',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { CoBenefitV2Mirror };
