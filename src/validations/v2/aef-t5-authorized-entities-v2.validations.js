import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const aefT5AuthorizedEntitiesV2Schema = Joi.object({
  cadTrustAefT5AuthorizedEntitiesId: Joi.number().optional(),
  aefT5AuthorizedEntitiesId: Joi.string().required(),
  aefT5AuthorizedEntitiesIncorporationCountry: Joi.string()
    .custom(pickListValidation('countries'))
    .optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
