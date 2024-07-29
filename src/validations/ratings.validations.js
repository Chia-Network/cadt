import Joi from 'joi';
import { pickListValidation } from '../utils/validation-utils.js';

export const ratingSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  ratingType: Joi.string().custom(pickListValidation('ratingType')).required(),
  ratingRangeLowest: Joi.string().required(),
  ratingRangeHighest: Joi.string().required(),
  rating: Joi.string().required(),
  ratingLink: Joi.string().required(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
