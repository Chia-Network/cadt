import Joi from 'joi';

export const newOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  icon: Joi.string().required(),
});

export const importOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
});
