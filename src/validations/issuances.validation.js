import Joi from 'joi';

export const issuanceSchema = Joi.object({
  // orgUid - derived upon creation
  id: Joi.string().optional(),
  warehouseProjectId: Joi.string().optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  verificationApproach: Joi.string().required(),
  verificationBody: Joi.string().required(),
  verificationReportDate: Joi.date().required(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
