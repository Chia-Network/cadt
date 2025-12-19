import Joi from 'joi';
import { getPicklistValuesV2 } from '../../utils/v2-data-loaders.js';

const metricPicklist = getPicklistValuesV2().metric || [];
const sectorPicklist = getPicklistValuesV2().sector || [];
const typePicklist = getPicklistValuesV2().type || [];
const purposePicklist = getPicklistValuesV2().purpose || [];

export const aefT2AuthorizationsV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustAefT2AuthorizationsId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustAefT2AuthorizationsId is auto-generated and cannot be set via API',
  }),

  // Required fields
  aefT2AuthorizationsId: Joi.string().max(255).required().messages({
    'any.required': 'aefT2AuthorizationsId is required',
    'string.max': 'aefT2AuthorizationsId must not exceed 255 characters',
  }),

  aefT2AuthorizationsDate: Joi.date().iso().required().messages({
    'any.required': 'aefT2AuthorizationsDate is required',
    'date.iso': 'aefT2AuthorizationsDate must be a valid ISO 8601 date',
  }),

  aefT2AuthorizationsCooperativeApproachId: Joi.string().max(255).required().messages({
    'any.required': 'aefT2AuthorizationsCooperativeApproachId is required',
    'string.max': 'aefT2AuthorizationsCooperativeApproachId must not exceed 255 characters',
  }),

  aefT2AuthorizationsAuthorizedPartyId: Joi.string().max(255).required().messages({
    'any.required': 'aefT2AuthorizationsAuthorizedPartyId is required',
    'string.max': 'aefT2AuthorizationsAuthorizedPartyId must not exceed 255 characters',
  }),

  // Optional fields
  aefT2AuthorizationsVersion: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsVersion must not exceed 255 characters',
  }),

  aefT2AuthorizationsQuantity: Joi.number().precision(2).allow(null).optional().messages({
    'number.base': 'aefT2AuthorizationsQuantity must be a number',
  }),

  aefT2AuthorizationsMetric: Joi.string().valid(...metricPicklist).allow(null).optional().messages({
    'any.only': `aefT2AuthorizationsMetric does not include a valid option. Valid options are: ${metricPicklist.join(', ')}`,
  }),

  aefT2AuthorizationsGwpValue: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsGwpValue must not exceed 255 characters',
  }),

  aefT2AuthorizationsApplicableNonGhgMetric: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsApplicableNonGhgMetric must not exceed 255 characters',
  }),

  aefT2AuthorizationsSector: Joi.string().valid(...sectorPicklist).allow(null).optional().messages({
    'any.only': `aefT2AuthorizationsSector does not include a valid option. Valid options are: ${sectorPicklist.join(', ')}`,
  }),

  aefT2AuthorizationsActivityType: Joi.string().valid(...typePicklist).allow(null).optional().messages({
    'any.only': `aefT2AuthorizationsActivityType does not include a valid option. Valid options are: ${typePicklist.join(', ')}`,
  }),

  aefT2AuthorizationsPurposesForAuthorization: Joi.string().valid(...purposePicklist).allow(null).optional().messages({
    'any.only': `aefT2AuthorizationsPurposesForAuthorization does not include a valid option. Valid options are: ${purposePicklist.join(', ')}`,
  }),

  aefT2AuthorizationsAuthoziedEntityId: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsAuthoziedEntityId must not exceed 255 characters',
  }),

  aefT2AuthorizationsOimpAuthorizedParty: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsOimpAuthorizedParty must not exceed 255 characters',
  }),

  aefT2AuthorizationsAuthorizedTimeframe: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsAuthorizedTimeframe must not exceed 255 characters',
  }),

  aefT2AuthorizationsAuthorizationTerms: Joi.string().max(255).allow(null).optional().messages({
    'string.max': 'aefT2AuthorizationsAuthorizationTerms must not exceed 255 characters',
  }),

  aefT2AuthorizationsAuthorizationDocumentation: Joi.string().allow(null).optional().messages({
    'string.base': 'aefT2AuthorizationsAuthorizationDocumentation must be a string',
  }),

  aefT2AuthorizationsFirstTransferDefinitionOimp: Joi.string().allow(null).optional().messages({
    'string.base': 'aefT2AuthorizationsFirstTransferDefinitionOimp must be a string',
  }),

  aefT2AuthorizationsAdditionalInformation: Joi.string().allow(null).optional().messages({
    'string.base': 'aefT2AuthorizationsAdditionalInformation must be a string',
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

  cadTrustAefT5AuthorizedEntitiesId: Joi.string().uuid().allow(null).optional().messages({
    'string.guid': 'cadTrustAefT5AuthorizedEntitiesId must be a valid UUID',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
