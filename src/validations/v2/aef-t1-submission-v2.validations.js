import Joi from 'joi';

export const aefT1SubmissionV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustAefT1SubmissionId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustAefT1SubmissionId is auto-generated and cannot be set via API',
  }),

  // Required fields
  aefT1SubmissionParty: Joi.string().max(255).required().messages({
    'any.required': 'aefT1SubmissionParty is required',
    'string.max': 'aefT1SubmissionParty must not exceed 255 characters',
  }),

  aefT1SubmissionVersion: Joi.string().max(255).required().messages({
    'any.required': 'aefT1SubmissionVersion is required',
    'string.max': 'aefT1SubmissionVersion must not exceed 255 characters',
  }),

  aefT1SubmissionReportYear: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'aefT1SubmissionReportYear is required',
    'number.base': 'aefT1SubmissionReportYear must be a number',
    'number.integer': 'aefT1SubmissionReportYear must be an integer',
    'number.min': 'aefT1SubmissionReportYear must be between 1900 and 2100',
    'number.max': 'aefT1SubmissionReportYear must be between 1900 and 2100',
  }),

  aefT1SubmissionSubmissionDate: Joi.date().iso().required().messages({
    'any.required': 'aefT1SubmissionSubmissionDate is required',
    'date.iso': 'aefT1SubmissionSubmissionDate must be a valid ISO 8601 date',
  }),

  // Optional fields
  aefT1SubmissionReviewStatus: Joi.string().allow(null).messages({
    'string.base': 'aefT1SubmissionReviewStatus must be a string',
  }),

  aefT1SubmissionResultCheck: Joi.string().allow(null).messages({
    'string.base': 'aefT1SubmissionResultCheck must be a string',
  }),

  aefT1SubmissionNdcFirstYear: Joi.number().integer().min(1900).max(2100).allow(null).messages({
    'number.base': 'aefT1SubmissionNdcFirstYear must be a number',
    'number.integer': 'aefT1SubmissionNdcFirstYear must be an integer',
    'number.min': 'aefT1SubmissionNdcFirstYear must be between 1900 and 2100',
    'number.max': 'aefT1SubmissionNdcFirstYear must be between 1900 and 2100',
  }),

  aefT1SubmissionNdcLastYear: Joi.number().integer().min(1900).max(2100).allow(null).messages({
    'number.base': 'aefT1SubmissionNdcLastYear must be a number',
    'number.integer': 'aefT1SubmissionNdcLastYear must be an integer',
    'number.min': 'aefT1SubmissionNdcLastYear must be between 1900 and 2100',
    'number.max': 'aefT1SubmissionNdcLastYear must be between 1900 and 2100',
  }),

  aefT1SubmissionReferenceReviewReport: Joi.string().uri().allow(null).messages({
    'string.uri': 'aefT1SubmissionReferenceReviewReport must be a valid URI',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
