import Joi from 'joi';

export const activityV2Schema = Joi.object({
  cadTrustActivityId: Joi.number().optional(),
  activityProgramName: Joi.string().required(),
  activityRegistry: Joi.string().required(),
  activityRegistryActivityId: Joi.string().required(),
  activityRegistryProgramId: Joi.string().optional(),
  activityDescription: Joi.string().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
