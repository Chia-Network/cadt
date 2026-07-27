import Sequelize from 'sequelize';
export default {
  cadTrustRatingId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  ratingType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  ratingName: {
    type: Sequelize.STRING,
    allowNull: false,
    field: 'rating_name',
  },
  ratingValue: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  ratingLink: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: false,
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
