import Joi from 'joi';

export const unitLabelV2Schema = Joi.object({
  cadTrustLabelId: Joi.number().required(),
  cadTrustUnitId: Joi.number().required(),
  labelUnitDate: Joi.date().optional(),
  labelUnitDescription: Joi.string().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
