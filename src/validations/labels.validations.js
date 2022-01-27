import Joi from 'joi';

const baseSchema = {
  label: Joi.string().required(),
  creditingPeriodStartDate: Joi.date().required(),
  creditingPeriodEndDate: Joi.date().required(),
  validityStartDate: Joi.date().required(),
  validityPeriodEndDate: Joi.date().required(),
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
