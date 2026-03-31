import Sequelize from 'sequelize';
export default {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  key: {
    type: Sequelize.STRING,
    unique: true,
  },
  value: Sequelize.STRING,
};
