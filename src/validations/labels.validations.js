import Joi from 'joi';

export const labelSchema = Joi.object({
  id: Joi.string().optional(),
  label: Joi.string().required(),
  creditingPeriodStartDate: Joi.string().required(),
  creditingPeriodEndDate: Joi.string().required(),
  validityPeriodStartDate: Joi.string().required(),
  validityPeriodEndDate: Joi.string().required(),
  unitQuantity: Joi.number().integer().required(),
  labelLink: Joi.string().required(),
});
