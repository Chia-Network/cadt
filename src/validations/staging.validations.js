import Joi from 'joi';

export const stagingDeleteSchema = Joi.object({
  uuid: Joi.string().required(),
});

export const stagingGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    type: Joi.string(),
  })
  .with('page', 'limit');
