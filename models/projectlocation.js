'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProjectLocation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  ProjectLocation.init({
    id: Sequelize.INTEGER,
    countryRegion: Sequelize.STRING,
    country: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  }, {
    sequelize,
    modelName: 'ProjectLocation',
  });
  return ProjectLocation;
};