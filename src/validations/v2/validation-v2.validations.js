import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for validation - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const validationV2Schema = Joi.object({
  validationId: Joi.string().required(),
  validationType: Joi.string()
    .custom(pickListValidationV2('validationType'))
    .required(),
  validationBody: Joi.string()
    .custom(pickListValidationV2('validationBody'))
    .required(),
  validationDate: Joi.date().allow(null).optional(),
  validationCreditPeriodStartDate: Joi.date().allow(null).optional(),
  validationCreditPeriodEndDate: Joi.date().allow(null).optional(),
  cadTrustProjectId: Joi.string().uuid().required(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustValidationId is auto-generated UUID
});
