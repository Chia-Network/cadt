'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Unit extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Unit.init({
    owner: DataTypes.STRING,
    buyer: DataTypes.STRING,
    registry: DataTypes.STRING,
    blockIdentifier: DataTypes.STRING,
    identifier: DataTypes.STRING,
    qualificationId: DataTypes.NUMBER,
    unitType: DataTypes.STRING,
    unitCount: DataTypes.NUMBER,
    unitStatus: DataTypes.STRING,
    unitStatusDate: DataTypes.DATE,
    transactionType: DataTypes.STRING,
    unitIssuanceLocation: DataTypes.STRING,
    unitLink: DataTypes.STRING,
    correspondingAdjustment: DataTypes.STRING,
    unitTag: DataTypes.STRING,
    vintageId: DataTypes.NUMBER,
    qualificationId: DataTypes.NUMBER,
    owner: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Unit',
  });
  return Unit;
};