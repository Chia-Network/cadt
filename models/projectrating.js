'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProjectRating extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  ProjectRating.init({
    id: Sequelize.INTEGER,
    ratingType: Sequelize.STRING,
    rating: Sequelize.NUMBER,
    link: Sequelize.STRING,
    scale: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  }, {
    sequelize,
    modelName: 'ProjectRating',
  });
  return ProjectRating;
};