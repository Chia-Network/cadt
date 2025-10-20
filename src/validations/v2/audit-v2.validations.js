import Joi from 'joi';

export const auditV2Schema = Joi.object({
  id: Joi.number().optional(),
  orgUid: Joi.string().required(),
  registryId: Joi.string().optional(),
  rootHash: Joi.string().optional(),
  type: Joi.string().required(),
  change: Joi.string().required(),
  table: Joi.string().required(),
  onchainConfirmationTimeStamp: Joi.date().optional(),
  author: Joi.string().optional(),
  comment: Joi.string().optional(),
  generation: Joi.number().optional(),
});
