import Joi from 'joi';

const baseSchema = {
  country: Joi.string().required(),
  inCountryRegion: Joi.string().required(),
  geographicIdentifier: Joi.string().required(),
};

export const newLocationSchema = Joi.object({ ...baseSchema });

export const existingLocationSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});
