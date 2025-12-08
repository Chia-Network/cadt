import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for methodology - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const methodologyV2Schema = Joi.object({
  methodologyCode: Joi.string().required(),
  methodologyName: Joi.string().required(),
  methodologyVersion: Joi.string().optional(),
  methodologyDate: Joi.date().optional(),
  methodologyLink: Joi.string().uri().optional(),
  methodologyType: Joi.string()
    .custom(pickListValidationV2('methodologyType'))
    .optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustMethodologyId is auto-generated UUID
});
