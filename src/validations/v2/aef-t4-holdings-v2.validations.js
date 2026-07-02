import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

export const aefT4HoldingsV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustAefT4HoldingsId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustAefT4HoldingsId is auto-generated and cannot be set via API',
  }),

  // Required fields
  aefT4HoldingsCooperativeApproachId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsCooperativeApproachId is required',
    'string.max': 'aefT4HoldingsCooperativeApproachId must not exceed 255 characters',
  }),

  aefT4HoldingsAuthorizationId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsAuthorizationId is required',
    'string.max': 'aefT4HoldingsAuthorizationId must not exceed 255 characters',
  }),

  aefT4HoldingsFirstTransferringPartyId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsFirstTransferringPartyId is required',
    'string.max': 'aefT4HoldingsFirstTransferringPartyId must not exceed 255 characters',
  }),

  aefT4HoldingsPartyItmoRegistryId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsPartyItmoRegistryId is required',
    'string.max': 'aefT4HoldingsPartyItmoRegistryId must not exceed 255 characters',
  }),

  aefT4HoldingsItmoFirstId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsItmoFirstId is required',
    'string.max': 'aefT4HoldingsItmoFirstId must not exceed 255 characters',
  }),

  aefT4HoldingsItmoLastId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsItmoLastId is required',
    'string.max': 'aefT4HoldingsItmoLastId must not exceed 255 characters',
  }),

  aefT4HoldingsUnitRegistryId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsUnitRegistryId is required',
    'string.max': 'aefT4HoldingsUnitRegistryId must not exceed 255 characters',
  }),

  aefT4HoldingsUnitFirstId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsUnitFirstId is required',
    'string.max': 'aefT4HoldingsUnitFirstId must not exceed 255 characters',
  }),

  aefT4HoldingsUnitLastId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsUnitLastId is required',
    'string.max': 'aefT4HoldingsUnitLastId must not exceed 255 characters',
  }),

  aefT4HoldingsQuantityTCo2: Joi.number().precision(2).required().messages({
    'any.required': 'aefT4HoldingsQuantityTCo2 is required',
    'number.base': 'aefT4HoldingsQuantityTCo2 must be a number',
  }),

  aefT4HoldingsVintageYear: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'aefT4HoldingsVintageYear is required',
    'number.integer': 'aefT4HoldingsVintageYear must be an integer',
    'number.min': 'aefT4HoldingsVintageYear must be greater than or equal to 1900',
    'number.max': 'aefT4HoldingsVintageYear must be less than or equal to 2100',
  }),

  // Optional fields
  aefT4HoldingsMetric: Joi.string()
    .custom(pickListValidationV2('aefT2AuthorizationsMetric', 'aefT4HoldingsMetric'))
    .allow(null).optional(),

  aefT4HoldingsGwpValue: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT4HoldingsGwpValue must not exceed 255 characters',
  }),

  aefT4HoldingsApplicableNonGhgMetric: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT4HoldingsApplicableNonGhgMetric must not exceed 255 characters',
  }),

  aefT4HoldingsQuantityNonGhg: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT4HoldingsQuantityNonGhg must not exceed 255 characters',
  }),

  aefT4HoldingsMitigationType: Joi.string()
    .custom(pickListValidationV2('aefT3ActionsMitigationType', 'aefT4HoldingsMitigationType'))
    .allow(null).optional(),

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

  cadTrustAefT2AuthorizationsId: Joi.string().uuid().allow(null).optional().messages({
    'string.guid': 'cadTrustAefT2AuthorizationsId must be a valid UUID',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
