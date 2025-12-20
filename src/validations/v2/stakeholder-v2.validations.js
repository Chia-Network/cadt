import Joi from 'joi';

export const stakeholderV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustStakeholderId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustStakeholderId is auto-generated and cannot be set via API',
  }),

  // Required fields
  stakeholderName: Joi.string().max(255).required().messages({
    'any.required': 'stakeholderName is required',
    'string.max': 'stakeholderName must not exceed 255 characters',
  }),

  // Optional fields with validation
  stakeholderType: Joi.string().valid('Owner', 'Developer', 'Consultant').allow(null).optional().messages({
    'any.only': 'stakeholderType must be one of: Owner, Developer, Consultant',
  }),

  stakeholderLink: Joi.alternatives().try(Joi.string().uri().max(500), Joi.allow(null, '')).optional().messages({
    'string.uri': 'stakeholderLink must be a valid URI',
    'string.max': 'stakeholderLink must not exceed 500 characters',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
