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
    id: Sequelize.INTEGER,
    projectId: Sequelize.NUMBER,
    type: Sequelize.STRING,
    label: Sequelize.STRING,
    creditingPeriodStartDate: Sequelize.DATE,
    creditingPeriodEndDate: Sequelize.DATE,
    validityStartDate: Sequelize.DATE,
    validityEndDate: Sequelize.DATE,
    unitQuantity: Sequelize.NUMBER,
    owner: Sequelize.STRING,
    unitId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  }, {
    sequelize,
    modelName: 'Qualification',
  });
  return Qualification;
};