import Joi from 'joi';
import { getPicklistValuesV2 } from '../../utils/v2-data-loaders.js';

const typePicklist = getPicklistValuesV2().type || [];
const metricPicklist = getPicklistValuesV2().metric || [];

export const aefT3ActionsV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustAefT3ActionsId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustAefT3ActionsId is auto-generated and cannot be set via API',
  }),

  // Required fields
  aefT3ActionsDate: Joi.date().iso().required().messages({
    'any.required': 'aefT3ActionsDate is required',
    'date.iso': 'aefT3ActionsDate must be a valid ISO 8601 date',
  }),

  aefT3ActionsCoopoerativeApproachId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsCoopoerativeApproachId is required',
    'string.max': 'aefT3ActionsCoopoerativeApproachId must not exceed 255 characters',
  }),

  aefT3ActionsAuthorizationId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsAuthorizationId is required',
    'string.max': 'aefT3ActionsAuthorizationId must not exceed 255 characters',
  }),

  aefT3ActionsFirstTransferringPartyId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsFirstTransferringPartyId is required',
    'string.max': 'aefT3ActionsFirstTransferringPartyId must not exceed 255 characters',
  }),

  aefT3ActionsPartyItmoRegistryId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsPartyItmoRegistryId is required',
    'string.max': 'aefT3ActionsPartyItmoRegistryId must not exceed 255 characters',
  }),

  aefT3ActionsItmoFirstId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsItmoFirstId is required',
    'string.max': 'aefT3ActionsItmoFirstId must not exceed 255 characters',
  }),

  aefT3ActionsItmoLastId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsItmoLastId is required',
    'string.max': 'aefT3ActionsItmoLastId must not exceed 255 characters',
  }),

  aefT3ActionsUnitRegistryId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsUnitRegistryId is required',
    'string.max': 'aefT3ActionsUnitRegistryId must not exceed 255 characters',
  }),

  aefT3ActionsUnitFirstId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsUnitFirstId is required',
    'string.max': 'aefT3ActionsUnitFirstId must not exceed 255 characters',
  }),

  aefT3ActionsUnitLastId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsUnitLastId is required',
    'string.max': 'aefT3ActionsUnitLastId must not exceed 255 characters',
  }),

  aefT3ActionsQuantityTCo2: Joi.number().precision(2).required().messages({
    'any.required': 'aefT3ActionsQuantityTCo2 is required',
    'number.base': 'aefT3ActionsQuantityTCo2 must be a number',
  }),

  aefT3ActionsVintageYear: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'aefT3ActionsVintageYear is required',
    'number.integer': 'aefT3ActionsVintageYear must be an integer',
    'number.min': 'aefT3ActionsVintageYear must be greater than or equal to 1900',
    'number.max': 'aefT3ActionsVintageYear must be less than or equal to 2100',
  }),

  aefT3ActionsTransferringPartyId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsTransferringPartyId is required',
    'string.max': 'aefT3ActionsTransferringPartyId must not exceed 255 characters',
  }),

  aefT3ActionsAcquiringPartyId: Joi.string().max(255).required().messages({
    'any.required': 'aefT3ActionsAcquiringPartyId is required',
    'string.max': 'aefT3ActionsAcquiringPartyId must not exceed 255 characters',
  }),

  // Optional fields
  aefT3ActionsType: Joi.string().valid(...typePicklist).allow(null).messages({
    'any.only': `aefT3ActionsType does not include a valid option. Valid options are: ${typePicklist.join(', ')}`,
  }),

  aefT3ActionsSubtype: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsSubtype must not exceed 255 characters',
  }),

  aefT3ActionsMetric: Joi.string().valid(...metricPicklist).allow(null).messages({
    'any.only': `aefT3ActionsMetric does not include a valid option. Valid options are: ${metricPicklist.join(', ')}`,
  }),

  aefT3ActionsGwpValue: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsGwpValue must not exceed 255 characters',
  }),

  aefT3ActionsApplicableNonGhgMetric: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsApplicableNonGhgMetric must not exceed 255 characters',
  }),

  aefT3ActionsQuantityNonGhg: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsQuantityNonGhg must not exceed 255 characters',
  }),

  aefT3ActionsMitigationType: Joi.string().valid(...typePicklist).allow(null).messages({
    'any.only': `aefT3ActionsMitigationType does not include a valid option. Valid options are: ${typePicklist.join(', ')}`,
  }),

  aefT3ActionsPurposeOfUseOimp: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsPurposeOfUseOimp must not exceed 255 characters',
  }),

  aefT3ActionsUsingParticipatingPartyId: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsUsingParticipatingPartyId must not exceed 255 characters',
  }),

  aefT3ActionsUsingAuthorizedEntityId: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsUsingAuthorizedEntityId must not exceed 255 characters',
  }),

  aefT3ActionsItmoUsedYear: Joi.number().integer().min(1900).max(2100).allow(null).messages({
    'number.integer': 'aefT3ActionsItmoUsedYear must be an integer',
    'number.min': 'aefT3ActionsItmoUsedYear must be greater than or equal to 1900',
    'number.max': 'aefT3ActionsItmoUsedYear must be less than or equal to 2100',
  }),

  aefT3ActionsConsistencyCheckResult: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsConsistencyCheckResult must not exceed 255 characters',
  }),

  aefT3ActionsAdditionalInformation: Joi.string().max(255).allow(null).messages({
    'string.max': 'aefT3ActionsAdditionalInformation must not exceed 255 characters',
  }),

  // Foreign keys - optional
  cadTrustAefT1SubmissionId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'cadTrustAefT1SubmissionId must be a valid UUID',
  }),

  cadTrustUnitId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'cadTrustUnitId must be a valid UUID',
  }),

  cadTrustProjectId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'cadTrustProjectId must be a valid UUID',
  }),

  cadTrustAefT2AuthorizationsId: Joi.string().uuid().allow(null).messages({
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
