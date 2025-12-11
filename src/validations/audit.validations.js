import Joi from 'joi';

export const auditGetSchema = Joi.object()
  .keys({
    page: Joi.number().required(),
    limit: Joi.number().required(),
    orgUid: Joi.string().required(),
    // Allow any string for order - controller will default invalid values to DESC
    order: Joi.string().optional(),
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
