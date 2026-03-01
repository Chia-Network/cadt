const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT1SubmissionId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
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
    set(value) {
      if (value !== null && value !== undefined) {
        // Validate ISO date format (YYYY-MM-DD) before Sequelize/moment.js tries to parse
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoDateRegex.test(value)) {
          throw new Error('aefT1SubmissionSubmissionDate must be in ISO format (YYYY-MM-DD)');
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('aefT1SubmissionSubmissionDate is not a valid date');
        }
      }
      this.setDataValue('aefT1SubmissionSubmissionDate', value);
    },
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
  orgUid: {
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
