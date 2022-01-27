import Joi from 'joi';

export const issuanceSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().timestamp().min(Joi.ref('startDate')).required(),
  verificationApproach: Joi.string().required(),
  verificationDate: Joi.date().required(),
  verificationBody: Joi.string().required(),
});
