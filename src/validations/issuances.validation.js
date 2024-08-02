import Joi from 'joi';

export const issuanceSchema = Joi.object({
  // orgUid - derived upon creation
  id: Joi.string().allow(null).optional(),
  warehouseProjectId: Joi.string().allow(null).optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  verificationApproach: Joi.string().required(),
  verificationBody: Joi.string(),
  verificationReportDate: Joi.date().required(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
  updatedAt: Joi.date().allow(null).optional(),
  createdAt: Joi.date().allow(null).optional(),
});
