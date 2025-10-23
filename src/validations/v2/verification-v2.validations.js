import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for verification - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const verificationV2Schema = Joi.object({
  verificationId: Joi.string().required(),
  verificationStartDate: Joi.date().optional(),
  verificationEndDate: Joi.date().optional(),
  verificationBody: Joi.string()
    .custom(pickListValidationV2('verificationBody'))
    .optional(),
  cadTrustProjectId: Joi.number().integer().required(),
  cadTrustValidationId: Joi.number().integer().optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustVerificationId is auto-generated INTEGER
});
