'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';

class ProjectV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
  ProjectV2Mirror.init(
    {
      cadTrustProjectId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        field: 'cad_trust_project_id',
      },
      orgUid: {
        type: Sequelize.STRING(64),
        allowNull: false,
        field: 'org_uid',
        comment: 'Organization UID - identifies which organization owns this project. Automatically set from home organization.',
      },
      projectRegistryName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'project_registry_name',
      },
      projectId: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'project_id',
      },
      projectCreditingProgram: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'project_crediting_program',
      },
      projectName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'project_name',
      },
      projectLink: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'project_link',
      },
      projectDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'project_description',
      },
      projectSector: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'project_sector',
      },
      projectType: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'project_type',
      },
      projectSubtype: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'project_subtype',
      },
      projectStatus: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'project_status',
      },
      projectStatusDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        field: 'project_status_date',
      },
      projectUnitMetric: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'project_unit_metric',
      },
      cadTrustReferenceProjectId: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'cad_trust_reference_project_id',
      },
      cadTrustProgramId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'cad_trust_program_id',
      },
    },
    {
      sequelize: sequelizeV2Mirror,
      modelName: 'ProjectV2Mirror',
      tableName: 'project',
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

export { ProjectV2Mirror };
