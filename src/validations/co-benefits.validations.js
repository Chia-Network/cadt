import Joi from 'joi';

const baseSchema = {
  cobenefit: Joi.string().required(),
};

export const newCobenefitSchema = Joi.object({ ...baseSchema });

export const existingCobenefitSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});
