import Joi from 'joi';

export const projectMethodologyV2Schema = Joi.object({
  // Required foreign keys
  cadTrustProjectId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustProjectId is required',
    'string.guid': 'cadTrustProjectId must be a valid UUID',
  }),

  cadTrustMethodologyId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustMethodologyId is required',
    'string.guid': 'cadTrustMethodologyId must be a valid UUID',
  }),

  // Optional fields
  projectMethodologyDate: Joi.date().iso().allow(null).optional().messages({
    'date.format': 'projectMethodologyDate must be a valid ISO date (YYYY-MM-DD)',
  }),

  projectMethodologyDescription: Joi.string().max(10000).allow(null).optional().messages({
    'string.max': 'projectMethodologyDescription must not exceed 10000 characters',
  }),

  // Forbidden fields - automatically managed or auto-generated
  createdAt: Joi.any().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.any().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
  cadTrustProjectMethodologyId: Joi.any().forbidden().messages({
    'any.unknown': 'cadTrustProjectMethodologyId is auto-generated and cannot be set via API',
  }),
}).unknown(false);
