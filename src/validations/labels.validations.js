import Joi from 'joi';

export const newLabelScheme = Joi.object({
  label: Joi.string().required(),
  creditingPeriodStartDate: Joi.date().required(),
  creditingPeriodEndDate: Joi.date().required(),
  validityStartDate: Joi.date().required(),
  validityPeriodEndDate: Joi.date().required(),
  unitQuantity: Joi.number().integer().required(),
  labelLink: Joi.string().required(),
});

export const existingLabelScheme = Joi.object({
  labelId: Joi.string().required(),
});
