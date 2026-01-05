'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class EstimationV2Mirror extends Model {
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
}

EstimationV2Mirror.init(
  {
    cadTrustEstimationId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_estimation_id',
      defaultValue: Sequelize.UUIDV4,
    },
    estimationStartDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'estimation_start_date',
    },
    estimationEndDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'estimation_end_date',
    },
    estimationUnitCount: {
      type: Sequelize.DECIMAL(20, 6),
      allowNull: true,
      field: 'estimation_unit_count',
    },
    estimationReferenceNo: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'estimation_reference_no',
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
    modelName: 'EstimationV2Mirror',
    tableName: 'estimation',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { EstimationV2Mirror };
