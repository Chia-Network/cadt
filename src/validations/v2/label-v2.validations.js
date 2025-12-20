import Joi from 'joi';

export const labelV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustLabelId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustLabelId is auto-generated and cannot be set via API',
  }),

  // Required fields
  labelName: Joi.string().max(255).required().messages({
    'any.required': 'labelName is required',
    'string.max': 'labelName must not exceed 255 characters',
  }),

  // Optional fields with validation
  labelType: Joi.string().valid(
    'Certification',
    'Article 6 - Endorsement',
    'Article 6 - Letter of Qualification',
    'Article 6 - Authorisation',
    'Article 6 - Letter of Approvals'
  ).allow(null).optional().messages({
    'any.only': 'labelType must be one of: Certification, Article 6 - Endorsement, Article 6 - Letter of Qualification, Article 6 - Authorisation, Article 6 - Letter of Approvals',
  }),

  labelLink: Joi.alternatives().try(Joi.string().uri().max(500), Joi.allow(null, '')).optional().messages({
    'string.uri': 'labelLink must be a valid URI',
    'string.max': 'labelLink must not exceed 500 characters',
  }),

  labelDate: Joi.date().iso().allow(null).optional().messages({
    'date.iso': 'labelDate must be a valid ISO 8601 date',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
