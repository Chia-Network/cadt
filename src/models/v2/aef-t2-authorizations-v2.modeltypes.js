import Sequelize from 'sequelize';
export default {
  cadTrustAefT2AuthorizationsId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  aefT2AuthorizationsId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT2AuthorizationsDate: {
    type: Sequelize.DATEONLY,
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
    type: Sequelize.DECIMAL,
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
  cadTrustAefT5AuthorizedEntitiesId: {
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
