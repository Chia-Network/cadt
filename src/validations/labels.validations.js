import Joi from 'joi';

const baseSchema = {
  label: Joi.string().required(),
  creditingPeriodStartDate: Joi.string().required(),
  creditingPeriodEndDate: Joi.string().required(),
  validityPeriodStartDate: Joi.string().required(),
  validityPeriodEndDate: Joi.string().required(),
  unitQuantity: Joi.number().integer().required(),
  labelLink: Joi.string().required(),
};

export const newLabelSchema = Joi.object({
  ...baseSchema,
});

export const existingLabelSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});
