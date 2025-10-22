import Joi from 'joi';

export const projectMethodologyV2Schema = Joi.object({
  cadTrustProjectId: Joi.string().required(),
  cadTrustMethodologyId: Joi.string().required(),
  projectMethodologyDate: Joi.date().optional(),
  projectMethodologyDescription: Joi.string().optional(),
});
