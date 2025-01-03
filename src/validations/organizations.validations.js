import Joi from 'joi';

export const newOrganizationWithIconSchema = Joi.object({
  name: Joi.string().required(),
  prefix: Joi.string().required(),
  icon: Joi.string().required(),
});

export const importOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
  isHome: Joi.bool().optional(),
});

export const unsubscribeOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
});

export const subscribeOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
});

export const resyncOrganizationSchema = Joi.object({
  orgUid: Joi.string().required(),
});

export const removeMirrorSchema = Joi.object({
  orgUid: Joi.string().required(),
  storeId: Joi.string().required(),
});

export const addMirrorSchema = Joi.object({
  storeId: Joi.string().required(),
  url: Joi.string().required(),
});

export const getMetaDataSchema = Joi.object({
  orgUid: Joi.string().required(),
});
