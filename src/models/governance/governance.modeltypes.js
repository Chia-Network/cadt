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
    required: true,
  },
  metaValue: {
    type: Sequelize.STRING,
    required: true,
  },
  confirmed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
};
