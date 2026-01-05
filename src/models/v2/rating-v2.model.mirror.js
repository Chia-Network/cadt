'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class RatingV2Mirror extends Model {
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
    modelName: 'RatingV2Mirror',
    tableName: 'rating',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { RatingV2Mirror };
