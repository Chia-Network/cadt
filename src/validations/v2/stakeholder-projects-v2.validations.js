import Joi from 'joi';

export const stakeholderProjectsV2Schema = Joi.object({
  cadTrustStakeholderProjectId: Joi.string().optional(),
  cadTrustStakeholderId: Joi.string().required(),
  cadTrustProjectId: Joi.string().required(),
});
