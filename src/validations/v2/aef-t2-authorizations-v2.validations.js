import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const aefT2AuthorizationsV2Schema = Joi.object({
  cadTrustAefT2AuthorizationsId: Joi.number().optional(),
  aefT2AuthorizationsId: Joi.string().required(),
  aefT2AuthorizationsDate: Joi.date().required(),
  aefT2AuthorizationsCooperativeApproachId: Joi.string().required(),
  aefT2AuthorizationsVersion: Joi.string().optional(),
  aefT2AuthorizationsQuantity: Joi.number().optional(),
  aefT2AuthorizationsMetric: Joi.string()
    .custom(pickListValidation('unitMetric'))
    .optional(),
  aefT2AuthorizationsGwpValue: Joi.string().optional(),
  aefT2AuthorizationsApplicableNonGhgMetric: Joi.string().optional(),
  aefT2AuthorizationsSector: Joi.string()
    .custom(pickListValidation('projectSector'))
    .optional(),
  aefT2AuthorizationsActivityType: Joi.string()
    .custom(pickListValidation('activityType'))
    .optional(),
  aefT2AuthorizationsPurposesForAuthorization: Joi.string()
    .custom(pickListValidation('authorizationPurpose'))
    .optional(),
  aefT2AuthorizationsAuthorizedPartyId: Joi.string().required(),
  aefT2AuthorizationsAuthoziedEntityId: Joi.string().optional(),
  aefT2AuthorizationsOimpAuthorizedParty: Joi.string().optional(),
  aefT2AuthorizationsAuthorizedTimeframe: Joi.string().optional(),
  aefT2AuthorizationsAuthorizationTerms: Joi.string().optional(),
  aefT2AuthorizationsAuthorizationDocumentation: Joi.string().optional(),
  aefT2AuthorizationsFirstTransferDefinitionOimp: Joi.string().optional(),
  aefT2AuthorizationsAdditionalInformation: Joi.string().optional(),
  cadTrustAefT1SubmissionId: Joi.number().optional(),
  cadTrustUnitId: Joi.number().optional(),
  cadTrustProjectId: Joi.number().optional(),
  cadTrustAefT5AuthorizedEntitiesId: Joi.number().optional(),
});
