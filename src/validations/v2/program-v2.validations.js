import Joi from 'joi';

export const programV2Schema = Joi.object({
  cadTrustProgramId: Joi.string().optional(),
  programName: Joi.string().required(),
  programRegistry: Joi.string().required(),
  programRegistryProgramId: Joi.string().required(),
  programRegistryActivityId: Joi.string().optional(),
  programDescription: Joi.string().optional(),
});
