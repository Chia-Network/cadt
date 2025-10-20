const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT2AuthorizationsId: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  aefT2AuthorizationsId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT2AuthorizationsDate: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  aefT2AuthorizationsCooperativeApproachId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT2AuthorizationsVersion: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsQuantity: {
    type: Sequelize.DECIMAL(20, 8),
    allowNull: true,
  },
  aefT2AuthorizationsMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsGwpValue: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsApplicableNonGhgMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsSector: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsActivityType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsPurposesForAuthorization: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsAuthorizedPartyId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT2AuthorizationsAuthoziedEntityId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsOimpAuthorizedParty: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsAuthorizedTimeframe: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsAuthorizationTerms: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT2AuthorizationsAuthorizationDocumentation: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  aefT2AuthorizationsFirstTransferDefinitionOimp: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  aefT2AuthorizationsAdditionalInformation: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
  cadTrustAefT1SubmissionId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  cadTrustUnitId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  cadTrustProjectId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  cadTrustAefT5AuthorizedEntitiesId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
};
