import Joi from 'joi';

export const newOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  file: Joi.string().required(),
});

export const importOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
  ip: Joi.string().required(),
  port: Joi.string().required(),
});

export const unsubscribeOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
});

export const subscribeOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
});
