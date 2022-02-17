import Joi from 'joi';

export const stagingDeleteSchema = Joi.object({
  uuid: Joi.string().required(),
});
