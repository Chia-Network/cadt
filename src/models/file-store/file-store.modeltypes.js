import Sequelize from 'sequelize';
export default {
  // ID is SHA256 so there are no file duplications
  SHA256: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true,
  },
  fileName: {
    type: Sequelize.STRING,
  },
  data: Sequelize.STRING,
  orgUid: Sequelize.STRING,
};
