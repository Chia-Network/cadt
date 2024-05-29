import Joi from 'joi';

export const auditGetSchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    orgUid: Joi.string(),
    order: Joi.string().valid('ASC', 'DESC').optional(),
  })
  .with('page', 'limit')
  .with('limit', 'page');

export const auditResetToGenerationSchema = Joi.object().keys({
  generation: Joi.number(),
  orgUid: Joi.string(),
});

export const auditResetToDateSchema = Joi.object().keys({
  date: Joi.date(),
  orgUid: Joi.string().optional(),
  includeHomeOrg: Joi.bool().optional(),
});
