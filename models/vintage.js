'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Vintage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Vintage.init({
    startDate: DataTypes.DATE,
    endDate: DataTypes.DATE,
    verificationApproach: DataTypes.STRING,
    verificationDate: DataTypes.DATE,
    verificationBody: DataTypes.STRING,
    owner: DataTypes.STRING,
    projectId: DataTypes.NUMBER
  }, {
    sequelize,
    modelName: 'Vintage',
  });
  return Vintage;
};