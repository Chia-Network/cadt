import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const ratingV2Schema = Joi.object({
  cadTrustRatingId: Joi.number().optional(),
  ratingType: Joi.string()
    .custom(pickListValidation('ratingType'))
    .optional(),
  ratingValue: Joi.string().required(),
  ratingLink: Joi.string().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  cadTrustProjectId: Joi.number().required(),
});
