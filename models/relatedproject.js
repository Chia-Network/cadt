'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RelatedProject extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  RelatedProject.init({
    relatedProjectType: DataTypes.STRING,
    registry: DataTypes.STRING,
    note: DataTypes.STRING,
    owner: DataTypes.STRING,
    projectId: DataTypes.NUMBER
  }, {
    sequelize,
    modelName: 'RelatedProject',
  });
  return RelatedProject;
};