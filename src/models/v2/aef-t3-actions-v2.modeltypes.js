import Sequelize from 'sequelize';
export default {
  cadTrustAefT3ActionsId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  aefT3ActionsDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
  },
  aefT3ActionsType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsSubtype: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsCooperativeApproachId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsAuthorizationId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsFirstTransferringPartyId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsPartyItmoRegistryId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsItmoFirstId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsItmoLastId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsUnitRegistryId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsUnitFirstId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsUnitLastId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsGwpValue: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsApplicableNonGhgMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsQuantityTCo2: {
    type: Sequelize.DECIMAL,
    allowNull: false,
  },
  aefT3ActionsQuantityNonGhg: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsMitigationType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsVintageYear: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  aefT3ActionsTransferringPartyId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsAcquiringPartyId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsPurposeOfUseOimp: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsUsingParticipatingPartyId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsUsingAuthorizedEntityId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsItmoUsedYear: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  aefT3ActionsConsistencyCheckResult: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsAdditionalInformation: {
    type: Sequelize.STRING,
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
  cadTrustAefT2AuthorizationsId: {
    type: Sequelize.UUID,
    allowNull: true,
  },
  createdByOrgUid: {
    type: Sequelize.STRING(64),
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
