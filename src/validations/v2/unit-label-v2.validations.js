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

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
