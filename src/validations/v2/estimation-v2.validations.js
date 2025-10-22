import Joi from 'joi';

export const estimationV2Schema = Joi.object({
  cadTrustEstimationId: Joi.string().optional(),
  estimationStartDate: Joi.date().required(),
  estimationEndDate: Joi.date().required(),
  estimationUnitCount: Joi.number().optional(),
  estimationReferenceNo: Joi.string().optional(),
  cadTrustProjectId: Joi.string().required(),
});
