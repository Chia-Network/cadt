import Joi from 'joi';

export const newRatingScheme = Joi.object({
  ratingType: Joi.string().required(),
  ratingRangeHighest: Joi.number().integer().required(),
  ratingRangeLowest: Joi.number().integer().required(),
  rating: Joi.number().integer().required(),
  ratingLink: Joi.string().optional(),
});

export const existingRatingSchema = Joi.object({
  ratingId: Joi.string().required(),
});
