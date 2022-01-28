import Joi from 'joi';

export const ratingSchema = Joi.object({
  id: Joi.string().optional(),
  ratingType: Joi.string().required(),
  ratingRangeHighest: Joi.number().integer().required(),
  ratingRangeLowest: Joi.number().integer().required(),
  rating: Joi.number().integer().required(),
  ratingLink: Joi.string().optional(),
  //'ratingLink' should be required.
});
