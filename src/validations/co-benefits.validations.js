import Joi from 'joi';

export const newCobenefitScheme = Joi.object({
  cobenefit: Joi.string().required(),
});

export const existingCobenefitSchema = Joi.object({
  cobenefitId: Joi.string().required(),
});
