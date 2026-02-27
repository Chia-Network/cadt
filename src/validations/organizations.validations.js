import Joi from 'joi';

export const newOrganizationWithIconSchema = Joi.object({
  name: Joi.string().required(),
  icon: Joi.string().allow('').optional(), // Icon is optional, can be any string (URL, base64, etc.) or empty
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

// orgUid can be either:
// - 64-character hex string (production datalayer store IDs)
// - UUID v4 format with hyphens (simulator mode)
const orgUidPattern = /^([a-fA-F0-9]{64}|[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})$/;

export const reclaimHomeSchema = Joi.object({
  orgUid: Joi.string().required(),
});

export const deleteOrganizationSchema = Joi.object({
  orgUid: Joi.string()
    .required()
    .pattern(orgUidPattern)
    .messages({
      'string.pattern.base': 'orgUid must be a valid 64-character hex string or UUID format',
      'any.required': 'orgUid is required',
    }),
});
