import Joi from 'joi';

export const projectMethodologyV2Schema = Joi.object({
  cadTrustProjectId: Joi.number().required(),
  cadTrustMethodologyId: Joi.number().required(),
  projectMethodologyDate: Joi.date().optional(),
  projectMethodologyDescription: Joi.string().optional(),
});
