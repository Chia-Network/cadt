import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

export const aefT5AuthorizedEntitiesV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustAefT5AuthorizedEntitiesId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustAefT5AuthorizedEntitiesId is auto-generated and cannot be set via API',
  }),

  // Required fields
  aefT5AuthorizedEntitiesAuthorizationDate: Joi.date().iso().required().messages({
    'any.required': 'aefT5AuthorizedEntitiesAuthorizationDate is required',
    'date.iso': 'aefT5AuthorizedEntitiesAuthorizationDate must be a valid ISO 8601 date',
  }),

  aefT5AuthorizedEntitiesName: Joi.string().max(255).required().messages({
    'any.required': 'aefT5AuthorizedEntitiesName is required',
    'string.max': 'aefT5AuthorizedEntitiesName must not exceed 255 characters',
  }),

  aefT5AuthorizedEntitiesId: Joi.string().max(255).required().messages({
    'any.required': 'aefT5AuthorizedEntitiesId is required',
    'string.max': 'aefT5AuthorizedEntitiesId must not exceed 255 characters',
  }),

  aefT5AuthorizedEntitiesCooperativeApproachId: Joi.string().max(255).required().messages({
    'any.required': 'aefT5AuthorizedEntitiesCooperativeApproachId is required',
    'string.max': 'aefT5AuthorizedEntitiesCooperativeApproachId must not exceed 255 characters',
  }),

  // Optional fields
  aefT5AuthorizedEntitiesIncorporationCountry: Joi.string()
    .max(255)
    .allow(null)
    .custom(pickListValidationV2('aefT5AuthorizedEntitiesIncorporationCountry'))
    .optional()
    .messages({
      'string.max': 'aefT5AuthorizedEntitiesIncorporationCountry must not exceed 255 characters',
    }),

  aefT5AuthorizedEntitiesConditions: Joi.string().allow(null).optional().messages({
    'string.base': 'aefT5AuthorizedEntitiesConditions must be a string',
  }),

  aefT5AuthorizedEntitiesChangeConditions: Joi.string().allow(null).optional().messages({
    'string.base': 'aefT5AuthorizedEntitiesChangeConditions must be a string',
  }),

  aefT5AuthorizedEntitiesAdditionalInformation: Joi.string().allow(null).optional().messages({
    'string.base': 'aefT5AuthorizedEntitiesAdditionalInformation must be a string',
  }),

  // Foreign keys - optional
  cadTrustAefT1SubmissionId: Joi.string().uuid().allow(null).optional().messages({
    'string.guid': 'cadTrustAefT1SubmissionId must be a valid UUID',
  }),

  cadTrustUnitId: Joi.string().uuid().allow(null).optional().messages({
    'string.guid': 'cadTrustUnitId must be a valid UUID',
  }),

  cadTrustProjectId: Joi.string().uuid().allow(null).optional().messages({
    'string.guid': 'cadTrustProjectId must be a valid UUID',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
