import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for unit - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const unitV2Schema = Joi.object({
  unitSerialId: Joi.string().required(),
  unitStartBlock: Joi.string().required(),
  unitEndBlock: Joi.string().required(),
  unitCount: Joi.number().min(0).optional(),
  unitType: Joi.string().optional().custom(pickListValidationV2('unitType', 'Unit Type')),
  unitVintageYear: Joi.number().integer().min(1900).max(2100).required(),
  unitStatus: Joi.string().optional().custom(pickListValidationV2('unitStatus', 'Unit Status')),
  unitStatusReason: Joi.string().optional(),
  unitStatusDate: Joi.date().optional(),
  unitRetirementDetail: Joi.string().optional(),
  unitRetirementBeneficiary: Joi.string().optional(),
  unitRetirementBeneficiaryId: Joi.string().optional(),
  unitLink: Joi.string().uri().optional(),
  unitMetric: Joi.string().optional().custom(pickListValidationV2('unitMetric', 'Unit Metric')),
  unitCurrentOwner: Joi.string().optional(),
  unitItmosReferenceId: Joi.string().optional(),
  cadTrustIssuanceId: Joi.string().uuid().required(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustUnitId is auto-generated UUID
});
