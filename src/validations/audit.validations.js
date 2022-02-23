import Joi from 'joi';

export const auditGetSchema = Joi.object().keys({
  orgUid: Joi.string().required(),
});
