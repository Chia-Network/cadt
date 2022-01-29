import Joi from 'joi';

export const locationSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  country: Joi.string().required(),
  inCountryRegion: Joi.string().required(),
  // Please make 'inCountryRegion' optional.
  geographicIdentifier: Joi.string().required(),
});
