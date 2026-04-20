'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class AefT1SubmissionV2Mirror extends Model {}

initMirrorModelV2(() => {
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
      sequelize: sequelizeV2Mirror,
      modelName: 'AefT1SubmissionV2Mirror',
      tableName: 'aef_t1_submission',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      timezone: '+00:00',
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
      dialectOptions: {
        charset: 'utf8mb4',
        dateStrings: true,
        typeCast: true,
      },
    }
  );
});

export { AefT1SubmissionV2Mirror };
