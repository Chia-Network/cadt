'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';

class ProjectLocation extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    ProjectLocation.belongsTo(Project);
  }
}

ProjectLocation.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    countryRegion: Sequelize.STRING,
    country: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'ProjectLocations',
  },
);

export { ProjectLocation };
