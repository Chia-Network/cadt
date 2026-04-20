'use strict';

import { Sequelize, Model } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class ProjectMethodologyV2Mirror extends Model {}

initMirrorModelV2(() => {
  ProjectMethodologyV2Mirror.init(
    {
      cadTrustProjectMethodologyId: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
        field: 'cad_trust_project_methodology_id',
        defaultValue: () => uuidv4(),
      },
      cadTrustProjectId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'cad_trust_project_id',
      },
      cadTrustMethodologyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'cad_trust_methodology_id',
      },
      projectMethodologyDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        field: 'project_methodology_date',
      },
      projectMethodologyDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'project_methodology_description',
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
      modelName: 'ProjectMethodologyV2Mirror',
      tableName: 'project_methodology',
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

export { ProjectMethodologyV2Mirror };
