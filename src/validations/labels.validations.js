import Joi from 'joi';
import { labelUnitSchema } from './labelUnit.validations';
import { pickListValidation } from '../utils/validation-utils';

export const labelSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  warehouseProjectId: Joi.string().optional(),
  label: Joi.string().required(),
  labelType: Joi.string().custom(pickListValidation('labelType')).required(),
  creditingPeriodStartDate: Joi.date().required(),
  creditingPeriodEndDate: Joi.date()
    .min(Joi.ref('creditingPeriodStartDate'))
    .required(),
  validityPeriodStartDate: Joi.string().required(),
  validityPeriodEndDate: Joi.date()
    .min(Joi.ref('validityPeriodStartDate'))
    .required(),
  unitQuantity: Joi.number().integer().required(),
  timeStaged: Joi.date().timestamp().optional(),
  labelLink: Joi.string().required(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  label_unit: labelUnitSchema.optional(),
});
