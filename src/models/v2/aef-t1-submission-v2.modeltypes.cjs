const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT1SubmissionId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
  },
  aefT1SubmissionParty: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT1SubmissionVersion: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT1SubmissionReportYear: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  aefT1SubmissionSubmissionDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
  },
  aefT1SubmissionReviewStatus: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  aefT1SubmissionResultCheck: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  aefT1SubmissionNdcFirstYear: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  aefT1SubmissionNdcLastYear: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  aefT1SubmissionReferenceReviewReport: {
    type: Sequelize.TEXT,
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
