import Joi from 'joi';

export const ratingSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  ratingType: Joi.string().required(),
  ratingRangeLowest: Joi.number().integer().required(),
  ratingRangeHighest: Joi.number()
    .integer()
    .min(Joi.ref('ratingRangeLowest'))
    .required(),
  rating: Joi.number()
    .integer()
    .min(Joi.ref('ratingRangeLowest'))
    .max(Joi.ref('ratingRangeHighest'))
    .required(),
  ratingLink: Joi.string().required(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
