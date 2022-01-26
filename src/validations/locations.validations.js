import Joi from 'joi';

export const newLocationScheme = Joi.object({
  country: Joi.string().required(),
  inCountryRegion: Joi.string().required(),
  geographicIdentifier: Joi.string().required(),
});

export const existingLocationSchema = Joi.object({
  projectLocationId: Joi.string().required(),
});
