import Joi from 'joi';

export const auditGetSchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    orgUid: Joi.string(),
  })
  .with('page', 'limit')
  .with('limit', 'page');
