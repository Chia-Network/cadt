import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for validation - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const validationV2Schema = Joi.object({
  validationId: Joi.string().required(),
  validationType: Joi.string()
    .custom(pickListValidationV2('validationType'))
    .optional(),
  validationBody: Joi.string()
    .custom(pickListValidationV2('validationBody'))
    .optional(),
  validationDate: Joi.date().optional(),
  validationCreditPeriodStartDate: Joi.date().optional(),
  validationCreditPeriodEndDate: Joi.date().optional(),
  cadTrustProjectId: Joi.number().integer().required(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustValidationId is auto-generated INTEGER
});
