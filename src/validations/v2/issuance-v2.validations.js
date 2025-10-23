import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for issuance - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const issuanceV2Schema = Joi.object({
  issuanceId: Joi.string().required(),
  issuanceDate: Joi.date().optional(),
  cadTrustVerificationId: Joi.number().integer().required(),
  cadTrustMethodologyId: Joi.string().required(),
  cadTrustLocationId: Joi.number().integer().optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustIssuanceId is auto-generated INTEGER
});
