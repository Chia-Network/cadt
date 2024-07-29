import Joi from 'joi';
import { pickListValidation } from '../utils/validation-utils.js';

export const locationSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  country: Joi.string()
    .custom(pickListValidation('countries', 'ProjectLocation Country'))
    .required(),
  inCountryRegion: Joi.string().allow(null, '').optional(),
  geographicIdentifier: Joi.alternatives()
    .try(Joi.string(), Joi.number())
    .required(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
  fileId: Joi.string().allow(null, '').optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
