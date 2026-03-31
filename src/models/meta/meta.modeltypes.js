import Sequelize from 'sequelize';
export default {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  metaKey: {
    type: Sequelize.STRING,
    unique: true,
  },
  metaValue: Sequelize.STRING,
};
