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
    ratingType: DataTypes.STRING,
    rating: DataTypes.NUMBER,
    link: DataTypes.STRING,
    scale: DataTypes.STRING,
    owner: DataTypes.STRING,
    projectId: DataTypes.NUMBER
  }, {
    sequelize,
    modelName: 'ProjectRating',
  });
  return ProjectRating;
};