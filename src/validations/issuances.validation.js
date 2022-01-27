import Joi from 'joi';

const baseSchema = {
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  verificationApproach: Joi.string().required(),
  verificationDate: Joi.date().required(),
  verificationBody: Joi.string().required(),
};

export const newIssuanceSchema = Joi.object({ ...baseSchema });

export const existingIssuanceSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});
