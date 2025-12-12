import Joi from 'joi';

export const auditGetSchema = Joi.object()
  .keys({
    page: Joi.number().integer().min(1).max(100000).required().messages({
      'number.base': 'Invalid page value. Must be a number',
      'number.integer': 'Invalid page value. Must be an integer',
      'number.min': 'Invalid page value. Must be between 1 and 100000',
      'number.max': 'Invalid page value. Must be between 1 and 100000',
      'any.required': 'page is required',
    }),
    limit: Joi.number().integer().min(1).max(10000).required().messages({
      'number.base': 'Invalid limit value. Must be a number',
      'number.integer': 'Invalid limit value. Must be an integer',
      'number.min': 'Invalid limit value. Must be between 1 and 10000',
      'number.max': 'Invalid limit value. Must be between 1 and 10000',
      'any.required': 'limit is required',
    }),
    orgUid: Joi.string().required(),
    order: Joi.string().optional(), // Allow any string, controller will default invalid values to DESC
  })
  .with('page', 'limit')
  .with('limit', 'page');

export const auditResetToGenerationSchema = Joi.object().keys({
  generation: Joi.number().required(),
  orgUid: Joi.string().required(),
});

export const auditResetToDateSchema = Joi.object().keys({
  date: Joi.date().required(),
  orgUid: Joi.string().optional(),
  includeHomeOrg: Joi.bool().optional(),
});
