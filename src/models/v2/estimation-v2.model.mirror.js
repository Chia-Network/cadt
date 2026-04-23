'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class EstimationV2Mirror extends Model {}

initMirrorModelV2(() => {
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
      sequelize: sequelizeV2Mirror,
      modelName: 'EstimationV2Mirror',
      tableName: 'estimation',
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

export { EstimationV2Mirror };
