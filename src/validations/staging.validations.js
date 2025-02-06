import Joi from 'joi';
import { getConfig } from '../utils/config-loader.js';
const { REQUEST_CONTENT_LIMITS } = getConfig();

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
  table: Joi.string().valid('Projects', 'Units').optional(),
});

export const stagingEditSchema = Joi.object({
  uuid: Joi.string().required(),
  data: Joi.array()
    .items(Joi.object())
    .required()
    .max(REQUEST_CONTENT_LIMITS.STAGING.EDIT_DATA_LEN),
});

export const stagingGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    type: Joi.string(),
    table: Joi.string().valid('Projects', 'Units').optional(),
  })
  .with('page', 'limit');
