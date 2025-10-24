'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class AefT1SubmissionV2Mirror extends Model {}

AefT1SubmissionV2Mirror.init(
  {
    cadTrustAefT1SubmissionId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_aef_t1_submission_id',
      defaultValue: Sequelize.UUIDV4,
    },
    aefT1SubmissionParty: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t1_submission_party',
    },
    aefT1SubmissionVersion: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t1_submission_version',
    },
    aefT1SubmissionReportYear: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'aef_t1_submission_report_year',
    },
    aefT1SubmissionSubmissionDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'aef_t1_submission_submission_date',
    },
    aefT1SubmissionReviewStatus: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t1_submission_review_status',
    },
    aefT1SubmissionResultCheck: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t1_submission_result_check',
    },
    aefT1SubmissionNdcFirstYear: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'aef_t1_submission_ndc_first_year',
    },
    aefT1SubmissionNdcLastYear: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'aef_t1_submission_ndc_last_year',
    },
    aefT1SubmissionReferenceReviewReport: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t1_submission_reference_review_report',
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: Sequelize.NOW,
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'AefT1SubmissionV2Mirror',
    tableName: 'aef_t1_submission',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { AefT1SubmissionV2Mirror };
