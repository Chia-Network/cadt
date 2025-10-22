import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const ratingV2Schema = Joi.object({
  cadTrustRatingId: Joi.string().optional(),
  ratingType: Joi.string()
    .custom(pickListValidation('ratingType'))
    .optional(),
  ratingValue: Joi.string().required(),
  ratingLink: Joi.string().optional(),
  cadTrustProjectId: Joi.string().required(),
});
