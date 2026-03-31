import Sequelize from 'sequelize';
export default {
  // ID is SHA256 so there are no file duplications
  sha256: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true,
  },
  file_name: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  data: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  org_uid: {
    type: Sequelize.STRING,
    allowNull: true,
  },
};

