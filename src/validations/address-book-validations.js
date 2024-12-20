import Joi from 'joi';

export const baseSchema = {
  name: Joi.string().required(),
  walletAddress: Joi.string().required(),
};

export const addressBookGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number().min(1),
    limit: Joi.number().max(1000).min(1),
    order: Joi.string().valid('ASC', 'DESC').optional(),
  })
  .with('page', 'limit')
  .with('limit', 'page');

export const addressBookPostSchema = Joi.object({
  ...baseSchema,
});

export const addressBookUpdateSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});

export const addressBookDeleteSchema = Joi.object({
  id: Joi.string().required(),
});
