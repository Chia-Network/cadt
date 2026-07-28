'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class RatingV2Mirror extends Model {}

initMirrorModelV2(() => {
  RatingV2Mirror.init(
    {
      cadTrustRatingId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        field: 'cad_trust_rating_id',
        defaultValue: Sequelize.UUIDV4,
      },
      ratingType: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'rating_type',
      },
      ratingName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'rating_name',
      },
      ratingValue: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'rating_value',
      },
      ratingLink: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'rating_link',
      },
      cadTrustProjectId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'cad_trust_project_id',
      },
      createdByOrgUid: {
        type: Sequelize.STRING(64),
        allowNull: true,
        field: 'created_by_org_uid',
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
      modelName: 'RatingV2Mirror',
      tableName: 'rating',
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

export { RatingV2Mirror };
