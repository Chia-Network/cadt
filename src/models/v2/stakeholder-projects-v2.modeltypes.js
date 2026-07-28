import Sequelize from 'sequelize';
export default {
  cadTrustStakeholderProjectId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  cadTrustStakeholderId: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  createdByOrgUid: {
    type: Sequelize.STRING(64),
    allowNull: true,
    field: 'created_by_org_uid',
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
