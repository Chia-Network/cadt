import Joi from 'joi';
import { genericSortColumnRegex } from '../utils/string-utils';

export const addressBookBaseSchema = {
  name: Joi.string().required(),
  walletAddress: Joi.string().required(),
};

export const addressBookGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number().min(1),
    limit: Joi.number().max(1000).min(1),
    order: Joi.string().regex(genericSortColumnRegex).max(100).min(1),
    id: Joi.string(),
  })
  .with('page', 'limit')
  .with('limit', 'page');

export const addressBookPostSchema = Joi.object({
  ...addressBookBaseSchema,
});

export const addressBookUpdateSchema = Joi.object({
  id: Joi.string().required(),
  ...addressBookBaseSchema,
});

export const addressBookDeleteSchema = Joi.object({
  id: Joi.string().required(),
});
