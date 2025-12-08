import Joi from 'joi';

export const projectMethodologyV2Schema = Joi.object({
  // Required foreign keys (composite primary key)
  cadTrustProjectId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustProjectId is required',
    'string.guid': 'cadTrustProjectId must be a valid UUID',
  }),

  cadTrustMethodologyId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustMethodologyId is required',
    'string.guid': 'cadTrustMethodologyId must be a valid UUID',
  }),

  // Optional fields
  projectMethodologyDate: Joi.date().iso().optional().messages({
    'date.format': 'projectMethodologyDate must be a valid ISO date (YYYY-MM-DD)',
  }),

  projectMethodologyDescription: Joi.string().max(10000).optional().messages({
    'string.max': 'projectMethodologyDescription must not exceed 10000 characters',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
