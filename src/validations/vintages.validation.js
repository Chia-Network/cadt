import Joi from 'joi';

export const newVintageScheme = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  verificationApproach: Joi.string().required(),
  verificationDate: Joi.date().required(),
  verificationBody: Joi.string().required(),
});

export const existingVintageSchema = Joi.object({
  vintageId: Joi.string().required(),
});
