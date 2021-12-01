'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Qualification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Qualification.init({
    projectId: DataTypes.NUMBER,
    type: DataTypes.STRING,
    label: DataTypes.STRING,
    creditingPeriodStartDate: DataTypes.DATE,
    creditingPeriodEndDate: DataTypes.DATE,
    owner: DataTypes.STRING,
    unitId: DataTypes.NUMBER
  }, {
    sequelize,
    modelName: 'Qualification',
  });
  return Qualification;
};