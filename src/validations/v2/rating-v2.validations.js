import Joi from 'joi';

export const ratingV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustRatingId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustRatingId is auto-generated and cannot be set via API',
  }),

  // Required fields
  ratingType: Joi.string().valid('CDP', 'CCQI').required().messages({
    'any.only': 'ratingType must be one of: CDP, CCQI',
    'any.required': 'ratingType is required',
  }),

  // Required fields
  ratingName: Joi.string().max(255).required().messages({
    'any.required': 'ratingName is required',
    'string.max': 'ratingName must not exceed 255 characters',
  }),
  ratingValue: Joi.string().max(255).required().messages({
    'any.required': 'ratingValue is required',
    'string.max': 'ratingValue must not exceed 255 characters',
  }),

  ratingLink: Joi.alternatives().try(Joi.string().uri(), Joi.allow(null, '')).optional().messages({
    'string.uri': 'ratingLink must be a valid URI',
  }),

  // Foreign key - required
  cadTrustProjectId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustProjectId is required',
    'string.guid': 'cadTrustProjectId must be a valid UUID',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
  createdByOrgUid: Joi.string().forbidden().messages({
    'any.unknown': 'createdByOrgUid is server-managed and cannot be set via API',
  }),
});
