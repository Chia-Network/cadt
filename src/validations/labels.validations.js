import Joi from 'joi';

export const labelSchema = Joi.object({
  id: Joi.string().optional(),
  label: Joi.string().required(),
  // Need to include 'labelType' as a required STRING
  creditingPeriodStartDate: Joi.string().required(),
  // This should be DATE instead of STRING.
  creditingPeriodEndDate: Joi.string().required(),
  // This should be DATE instead of STRING.
  validityPeriodStartDate: Joi.string().required(),
  // This should be DATE instead of STRING.
  validityPeriodEndDate: Joi.string().required(),
  // This should be DATE instead of STRING.
  unitQuantity: Joi.number().integer().required(),
  labelLink: Joi.string().required(),
});
