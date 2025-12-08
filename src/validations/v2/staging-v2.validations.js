import Joi from 'joi';

export const stagingRetryV2Schema = Joi.object({
  uuid: Joi.string().uuid().required().messages({
    'any.required': 'uuid is required',
    'string.guid': 'uuid must be a valid UUID',
  }),
});

export const stagingDeleteV2Schema = Joi.object({
  uuid: Joi.string().uuid().required().messages({
    'any.required': 'uuid is required',
    'string.guid': 'uuid must be a valid UUID',
  }),
});

