import Joi from 'joi';

export const ratingSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  ratingType: Joi.string().required(),
  ratingRangeLowest: Joi.string().required(),
  ratingRangeHighest: Joi.string().required(),
  rating: Joi.string().required(),
  ratingLink: Joi.string().required(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
