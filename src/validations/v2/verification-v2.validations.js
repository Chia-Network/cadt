import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for verification - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const verificationV2Schema = Joi.object({
  verificationId: Joi.string().required(),
  verificationStartDate: Joi.date().allow(null).optional(),
  verificationEndDate: Joi.date().allow(null).optional(),
  verificationBody: Joi.string()
    .custom(pickListValidationV2('verificationBody'))
    .required(),
  cadTrustProjectId: Joi.string().uuid().required(),
  cadTrustValidationId: Joi.string().uuid().allow(null).optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustVerificationId is auto-generated UUID
});
