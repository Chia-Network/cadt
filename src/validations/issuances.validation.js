import Joi from 'joi';

export const issuanceSchema = Joi.object({
  // orgUid - derived upon creation
  id: Joi.string().optional(),
  warehouseProjectId: Joi.string().optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  verificationApproach: Joi.string().required(),
  verificationDate: Joi.date().required(),
  verificationBody: Joi.string().required(),
  verificationReportDate: Joi.date().required(),
  updatedAt: Joi.date().timestamp().optional(),
  createdAt: Joi.date().timestamp().optional(),
});
