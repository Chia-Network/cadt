import Joi from 'joi';

export const issuanceSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  verificationApproach: Joi.string().required(),
  verificationDate: Joi.date().required(),
  verificationBody: Joi.string().required(),
});
