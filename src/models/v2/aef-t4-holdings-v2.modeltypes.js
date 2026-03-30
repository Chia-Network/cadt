import Sequelize from 'sequelize';
export default {
  cadTrustAefT4HoldingsId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  aefT4HoldingsCoopoerativeApproachId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsAuthorizationId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsFirstTransferringPartyId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsPartyItmoRegistryId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsItmoFirstId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsItmoLastId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsUnitRegistryId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsUnitFirstId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsUnitLastId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT4HoldingsGwpValue: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT4HoldingsApplicableNonGhgMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT4HoldingsQuantityTCo2: {
    type: Sequelize.DECIMAL,
    allowNull: false,
  },
  aefT4HoldingsQuantityNonGhg: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT4HoldingsMitigationType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT4HoldingsVintageYear: {
    type: Sequelize.INTEGER,
    allowNull: false,
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
  cadTrustAefT2AuthorizationsId: {
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
