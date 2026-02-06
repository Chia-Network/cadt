'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';

class ProgramV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
  ProgramV2Mirror.init(
    {
      cadTrustProgramId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        field: 'cad_trust_program_id',
        defaultValue: Sequelize.UUIDV4,
      },
      programName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'program_name',
      },
      programRegistry: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'program_registry',
      },
      programRegistryActivityId: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'program_registry_activity_id',
      },
      programRegistryProgramId: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'program_registry_program_id',
      },
      programDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'program_description',
      },
    },
    {
      sequelize: sequelizeV2Mirror,
      modelName: 'ProgramV2Mirror',
      tableName: 'program',
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

export { ProgramV2Mirror };
