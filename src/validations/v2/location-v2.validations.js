import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const locationV2Schema = Joi.object({
  cadTrustLocationId: Joi.number().optional(),
  locationCountry: Joi.string()
    .custom(pickListValidation('countries', 'locationCountry'))
    .optional(),
  locationRegion: Joi.string().optional(),
  locationGis: Joi.string().optional(),
  locationMapType: Joi.string().optional(),
  locationMapFileLink: Joi.string().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  cadTrustProjectId: Joi.number().required(),
});
