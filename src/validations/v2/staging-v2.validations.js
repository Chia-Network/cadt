import Joi from 'joi';

export const stagingV2Schema = Joi.object({
  id: Joi.number().optional(),
  uuid: Joi.string().required(),
  table: Joi.string().required(),
  action: Joi.string().required(),
  data: Joi.string().required(),
  commited: Joi.boolean().optional(),
  failedCommit: Joi.boolean().optional(),
  isTransfer: Joi.boolean().optional(),
});
