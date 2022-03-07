import Joi from 'joi';
import { pickListValidation } from '../utils/validation-utils';

export const locationSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  country: Joi.string()
    .custom(pickListValidation('countries', 'ProjectLocation Country'))
    .required(),
  inCountryRegion: Joi.string().optional(),
  geographicIdentifier: Joi.string().required(),
  timeStaged: Joi.date().timestamp().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
