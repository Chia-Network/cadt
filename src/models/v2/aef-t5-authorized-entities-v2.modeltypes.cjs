const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT5AuthorizedEntitiesId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  aefT5AuthorizedEntitiesAuthorizationDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
  },
  aefT5AuthorizedEntitiesName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT5AuthorizedEntitiesIncorporationCountry: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT5AuthorizedEntitiesId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT5AuthorizedEntitiesCooperativeApproachId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT5AuthorizedEntitiesConditions: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  aefT5AuthorizedEntitiesChangeConditions: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  aefT5AuthorizedEntitiesAdditionalInformation: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  cadTrustAefT1SubmissionId: {
    type: Sequelize.UUID,
    allowNull: true,
  },
  cadTrustUnitId: {
    type: Sequelize.UUID,
    allowNull: true,
  },
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
};
