'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';

class LocationV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
  LocationV2Mirror.init(
    {
      cadTrustLocationId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        field: 'cad_trust_location_id',
      },
      locationCountry: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'location_country',
      },
      locationRegion: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'location_region',
      },
      locationGis: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'location_gis',
      },
      locationMapType: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'location_map_type',
      },
      locationMapFileLink: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'location_map_file_link',
      },
      cadTrustProjectId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        field: 'cad_trust_project_id',
      },
    },
    {
      sequelize: sequelizeV2Mirror,
      modelName: 'LocationV2Mirror',
      tableName: 'location',
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

export { LocationV2Mirror };
