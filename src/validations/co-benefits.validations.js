import Joi from 'joi';

export const cobenefitSchema = Joi.object({
  id: Joi.string().optional(),
  cobenefit: Joi.string().required(),
  // cobenefit should be optional.
});
