import Joi from 'joi';

export const stakeholderProjectV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustStakeholderProjectId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustStakeholderProjectId is auto-generated and cannot be set via API',
  }),

  // Required foreign keys
  cadTrustStakeholderId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustStakeholderId is required',
    'string.guid': 'cadTrustStakeholderId must be a valid UUID',
  }),

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
