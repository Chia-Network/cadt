import Joi from 'joi';

const baseSchema = {
  ratingType: Joi.string().required(),
  ratingRangeHighest: Joi.number().integer().required(),
  ratingRangeLowest: Joi.number().integer().required(),
  rating: Joi.number().integer().required(),
  ratingLink: Joi.string().optional(),
};

export const newRatingSchema = Joi.object({ ...baseSchema });

export const existingRatingSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});
