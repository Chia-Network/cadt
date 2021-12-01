'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProjectRatings extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  ProjectRatings.init({
    ratingType: DataTypes.STRING,
    rating: DataTypes.NUMBER,
    link: DataTypes.STRING,
    scale: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'ProjectRatings',
  });
  return ProjectRatings;
};