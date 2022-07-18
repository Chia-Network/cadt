import Joi from 'joi';

export const stagingDeleteSchema = Joi.object({
  uuid: Joi.string().required(),
});

export const stagingRetrySchema = Joi.object({
  uuid: Joi.string().required(),
});

export const commitStagingSchema = Joi.object({
  author: Joi.string().optional(),
  comment: Joi.string().optional(),
  ids: Joi.array().items(Joi.string()).optional(),
});

export const stagingEditSchema = Joi.object({
  uuid: Joi.string().required(),
  data: Joi.object().required(),
});

export const stagingGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    type: Joi.string(),
    table: Joi.string().valid('Projects', 'Units').optional(),
  })
  .with('page', 'limit');
