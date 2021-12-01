'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Project extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Project.init({
    currentRegistry: DataTypes.STRING,
    registryOfOrigin: DataTypes.STRING,
    originProjectId: DataTypes.NUMBER,
    program: DataTypes.STRING,
    warehouseProjectId: DataTypes.NUMBER,
    projectName: DataTypes.STRING,
    projectLink: DataTypes.STRING,
    projectDeveloper: DataTypes.STRING,
    sector: DataTypes.STRING,
    projectType: DataTypes.STRING,
    coveredByNDC: DataTypes.STRING,
    NDCLinkage: DataTypes.STRING,
    projectStatus: DataTypes.STRING,
    projectStatusDate: DataTypes.DATE,
    unitMetric: DataTypes.STRING,
    methodology: DataTypes.STRING,
    methodologyVersion: DataTypes.STRING,
    validationApproach: DataTypes.STRING,
    validationDate: DataTypes.DATE,
    projectTag: DataTypes.STRING,
    estimatedAnnualAverageEmmisionReduction: DataTypes.STRING,
    owner: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Project',
  });
  return Project;
};