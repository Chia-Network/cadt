import Joi from 'joi';

export const stagingDeleteSchema = Joi.object({
  uuid: Joi.string().required(),
});

export const stagingRetrySchema = Joi.object({
  uuid: Joi.string().required(),
});

export const commitStagingSchema = Joi.object({
  comment: Joi.string().optional(),
});

export const stagingGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    type: Joi.string(),
    table: Joi.string().valid('Projects', 'Units').optional(),
  })
  .with('page', 'limit');
