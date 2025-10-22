import Joi from 'joi';

export const unitLabelV2Schema = Joi.object({
  cadTrustLabelId: Joi.string().required(),
  cadTrustUnitId: Joi.string().required(),
  labelUnitDate: Joi.date().optional(),
  labelUnitDescription: Joi.string().optional(),
});
