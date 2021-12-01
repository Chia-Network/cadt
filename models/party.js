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
    name: DataTypes.STRING,
    country: DataTypes.STRING,
    registry: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Party',
  });
  return Party;
};