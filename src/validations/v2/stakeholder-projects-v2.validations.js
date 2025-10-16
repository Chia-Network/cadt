import Joi from 'joi';

export const stakeholderProjectsV2Schema = Joi.object({
  cadTrustStakeholderProjectId: Joi.number().optional(),
  cadTrustStakeholderId: Joi.number().required(),
  cadTrustProjectId: Joi.number().required(),
});
