import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';
import { getConfig } from '../../utils/config-loader.js';

const { APP } = getConfig();

// Validation schema for unit - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const unitV2Schema = Joi.object({
  unitSerialId: Joi.string().required(),
  unitStartBlock: Joi.string().required(),
  unitEndBlock: Joi.string().required(),
  unitCount: Joi.number().min(0).allow(null).optional(),
  unitType: Joi.string().allow(null).optional().custom(pickListValidationV2('unitType', 'Unit Type')),
  unitVintageYear: Joi.number().integer().min(1900).max(2100).required(),
  unitStatus: Joi.string().allow(null).optional().custom(pickListValidationV2('unitStatus', 'Unit Status')),
  unitStatusReason: Joi.string().allow(null).optional(),
  unitStatusDate: Joi.date().allow(null).optional(),
  unitRetirementDetail: Joi.string().allow(null).optional(),
  unitRetirementBeneficiary: Joi.string().allow(null).optional(),
  unitRetirementBeneficiaryId: Joi.string().allow(null).optional(),
  unitLink: Joi.string()
    .uri()
    .max(500)
    .allow(null, '')
    .optional(),
  unitMetric: Joi.string().allow(null).optional().custom(pickListValidationV2('unitMetric', 'Unit Metric')),
  unitCurrentOwner: Joi.string().allow(null).optional(),
  unitItmosReferenceId: Joi.string().allow(null).optional(),
  marketplace: Joi.string().allow(null).optional(),
  marketplaceLink: Joi.string().allow(null).optional(),
  marketplaceIdentifier: Joi.string().disallow('').allow(null).optional(),
  cadTrustIssuanceId: Joi.string().uuid().required(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustUnitId is auto-generated UUID
  // Note: orgUid is automatically set from home organization and cannot be provided via API
  orgUid: Joi.forbidden().messages({
    'any.unknown': 'orgUid is automatically set from home organization and cannot be provided via API',
  }),
});

// Query parameter validation schema for unit findAll endpoint
export const unitV2QuerySchema = Joi.object({
  page: Joi.number().integer().min(1).when('xls', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  limit: Joi.number().integer().min(1).max(1000).when('xls', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  columns: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()),
  ).optional(),
  xls: Joi.boolean().optional(),
  orgUid: Joi.string().optional(),
  filter: Joi.string().optional(),
  order: Joi.string().optional(),
  search: Joi.string().optional(),
  includeProjectInfoInSearch: Joi.boolean().optional(),
  marketplaceIdentifiers: Joi.array()
    .items(Joi.string())
    .single()
    .max(APP.REQUEST_CONTENT_LIMITS.UNITS.MARKETPLACE_IDENTIFIERS_LEN || 200),
  hasMarketplaceIdentifier: Joi.boolean().optional(),
  onlyTokenizedUnits: Joi.boolean().optional(),
});
