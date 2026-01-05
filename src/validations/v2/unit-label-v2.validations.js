import Joi from 'joi';

export const unitLabelV2Schema = Joi.object({
  // Required foreign keys
  cadTrustLabelId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustLabelId is required',
    'string.guid': 'cadTrustLabelId must be a valid UUID',
  }),

  cadTrustUnitId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustUnitId is required',
    'string.guid': 'cadTrustUnitId must be a valid UUID',
  }),

  // Optional fields
  labelUnitDate: Joi.date().iso().allow(null).messages({
    'date.iso': 'labelUnitDate must be a valid ISO 8601 date',
  }),

  labelUnitDescription: Joi.string().allow(null).messages({
    'string.base': 'labelUnitDescription must be a string',
  }),

  // Forbidden fields - automatically managed or auto-generated
  createdAt: Joi.any().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.any().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
  cadTrustUnitLabelId: Joi.any().forbidden().messages({
    'any.unknown': 'cadTrustUnitLabelId is auto-generated and cannot be set via API',
  }),
}).unknown(false);
