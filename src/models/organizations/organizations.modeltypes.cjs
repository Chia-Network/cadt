const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orgUid: {
    type: Sequelize.STRING,
    unique: true,
  },
  name: Sequelize.STRING,
  icon: Sequelize.STRING,
  registryId: Sequelize.STRING,
  projectLocationStoreId: Sequelize.STRING,
  projectLocationStoreHash: Sequelize.STRING,
  projectRatingStoreId: Sequelize.STRING,
  projectRatingStoreHash: Sequelize.STRING,
  coBenefitsStoreId: Sequelize.STRING,
  coBenefitsStoreHash: Sequelize.STRING,
  projectsStoreId: Sequelize.STRING,
  projectsStoreIdHash: Sequelize.STRING,
  relatedProjectsStoreId: Sequelize.STRING,
  relatedProjectsStoreHash: Sequelize.STRING,
  vintagesStoreId: Sequelize.STRING,
  vintagesStoreHash: Sequelize.STRING,
  qualificationsStoreId: Sequelize.STRING,
  qualificationsStoreHash: Sequelize.STRING,
  qualificationUnitJunctionStoreId: Sequelize.STRING,
  qualificationUnitJunctionStoreHash: Sequelize.STRING,
  unitsStoreId: Sequelize.STRING,
  unitsStoreHash: Sequelize.STRING,
  subscribed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  isHome: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
