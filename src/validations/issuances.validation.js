import Joi from 'joi';

export const newIssuanceScheme = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  verificationApproach: Joi.string().required(),
  verificationDate: Joi.date().required(),
  verificationBody: Joi.string().required(),
});

export const existingIssuanceSchema = Joi.object({
  issuanceId: Joi.string().required(),
});
