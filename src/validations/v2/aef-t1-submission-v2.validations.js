import Joi from 'joi';

export const aefT1SubmissionV2Schema = Joi.object({
  cadTrustAefT1SubmissionId: Joi.string().optional(),
  aefT1SubmissionParty: Joi.string().required(),
  aefT1SubmissionVersion: Joi.string().required(),
  aefT1SubmissionReportYear: Joi.number().required(),
  aefT1SubmissionSubmissionDate: Joi.date().required(),
  aefT1SubmissionReviewStatus: Joi.string().optional(),
  aefT1SubmissionResultCheck: Joi.string().optional(),
  aefT1SubmissionNdcFirstYear: Joi.number().optional(),
  aefT1SubmissionNdcLastYear: Joi.number().optional(),
  aefT1SubmissionReferenceReviewReport: Joi.string().optional(),
});
