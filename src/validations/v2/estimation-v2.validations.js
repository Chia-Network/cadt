import Joi from 'joi';

export const estimationV2Schema = Joi.object({
  cadTrustEstimationId: Joi.number().optional(),
  estimationStartDate: Joi.date().required(),
  estimationEndDate: Joi.date().required(),
  estimationUnitCount: Joi.number().optional(),
  estimationReferenceNo: Joi.string().optional(),
  cadTrustProjectId: Joi.number().required(),
});
