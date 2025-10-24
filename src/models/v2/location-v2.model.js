'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class LocationV2 extends Model {
  static associate(models) {
    // Location belongs to Project
    LocationV2.belongsTo(models.ProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'project',
    });

    // Note: Other associations will be added when those models are implemented
    // - Location has many Issuances (when Issuance endpoint references location)
  }
}

LocationV2.init(
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
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_project_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'LocationV2',
    tableName: 'location',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { LocationV2 };
