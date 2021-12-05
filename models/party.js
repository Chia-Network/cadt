'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Party extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Party.init({
    id: Sequelize.INTEGER,
    name: Sequelize.STRING,
    country: Sequelize.STRING,
    registry: Sequelize.STRING,
    owner: Sequelize.STRING,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  }, {
    sequelize,
    modelName: 'Party',
  });
  return Party;
};