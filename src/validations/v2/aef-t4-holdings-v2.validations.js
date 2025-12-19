import Joi from 'joi';
import { getPicklistValuesV2 } from '../../utils/v2-data-loaders.js';

const typePicklist = getPicklistValuesV2().type || [];
const metricPicklist = getPicklistValuesV2().metric || [];

export const aefT4HoldingsV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustAefT4HoldingsId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustAefT4HoldingsId is auto-generated and cannot be set via API',
  }),

  // Required fields
  aefT4HoldingsCoopoerativeApproachId: Joi.string().max(255).required().messages({
    'any.required': 'aefT4HoldingsCoopoerativeApproachId is required',
    'string.max': 'aefT4HoldingsCoopoerativeApproachId must not exceed 255 characters',
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
  aefT4HoldingsMetric: Joi.string().valid(...metricPicklist).allow(null).optional().messages({
    'any.only': `aefT4HoldingsMetric does not include a valid option. Valid options are: ${metricPicklist.join(', ')}`,
  }),

  aefT4HoldingsGwpValue: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT4HoldingsGwpValue must not exceed 255 characters',
  }),

  aefT4HoldingsApplicableNonGhgMetric: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT4HoldingsApplicableNonGhgMetric must not exceed 255 characters',
  }),

  aefT4HoldingsQuantityNonGhg: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT4HoldingsQuantityNonGhg must not exceed 255 characters',
  }),

  aefT4HoldingsMitigationType: Joi.string().valid(...typePicklist).allow(null).optional().messages({
    'any.only': `aefT4HoldingsMitigationType does not include a valid option. Valid options are: ${typePicklist.join(', ')}`,
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
