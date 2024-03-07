import Joi from 'joi';

import { issuanceSchema } from './issuances.validation';
import { labelSchema } from './labels.validations';

import { pickListValidation } from '../utils/validation-utils';
import {
  genericFilterRegex,
  genericSortColumnRegex,
} from '../utils/string-utils';

const unitsBaseSchema = {
  // warehouseUnitId - derived upon unit creation
  // issuanceId - derived upon unit creation
  // orgUid - derived upon unit creation
  projectLocationId: Joi.string().allow(null).optional(),
  unitOwner: Joi.string().allow(null).optional(),
  countryJurisdictionOfOwner: Joi.string()
    .custom(pickListValidation('countries', 'countryJurisdictionOfOwner'))
    .required(),
  inCountryJurisdictionOfOwner: Joi.string().allow(null).optional(),
  unitBlockStart: Joi.string().required(),
  unitBlockEnd: Joi.string().required(),
  unitCount: Joi.number().integer().required(),
  // match 4 digit year
  vintageYear: Joi.number().integer().min(1900).max(3000).required(),
  unitType: Joi.string().custom(pickListValidation('unitType')).required(),
  marketplace: Joi.string().allow(null).optional(),
  marketplaceLink: Joi.string().allow(null).optional(),
  marketplaceIdentifier: Joi.string().disallow('').allow(null).optional(),
  unitTags: Joi.string().allow('').allow(null).optional(),
  unitStatus: Joi.string().custom(pickListValidation('unitStatus')).required(),
  unitStatusReason: Joi.string().when('unitStatus', {
    is: Joi.exist().valid('cancelled', 'retired'),
    then: Joi.required(),
    otherwise: Joi.allow(null).optional(),
  }),
  unitRegistryLink: Joi.string().required(),
  correspondingAdjustmentDeclaration: Joi.string()
    .custom(pickListValidation('correspondingAdjustmentDeclaration'))
    .required(),
  correspondingAdjustmentStatus: Joi.string()
    .custom(pickListValidation('correspondingAdjustmentStatus'))
    .required(),
  issuance: issuanceSchema.optional(),
  labels: Joi.array().items(labelSchema).optional(),
  updatedAt: Joi.date().allow(null).optional(),
  createdAt: Joi.date().allow(null).optional(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
};

export const unitsPostSchema = Joi.object({
  ...unitsBaseSchema,
});

export const unitsGetQuerySchema = Joi.object({
  page: Joi.number().min(1).optional(),
  limit: Joi.number().max(100).min(1).optional(),
  search: Joi.string().optional(),
  warehouseUnitId: Joi.string().optional(),
  columns: Joi.array().items(Joi.string()).single().optional(),
  orgUid: Joi.string().optional(),
  order: Joi.alternatives().try(
    Joi.string().valid('SERIALNUMBER', 'ASC', 'DESC').optional(),
    Joi.string().regex(genericSortColumnRegex).min(1).max(100).optional(),
  ),
  xls: Joi.boolean().optional(),
  marketplaceIdentifiers: Joi.array().items(Joi.string()).single().optional(),
  hasMarketplaceIdentifier: Joi.boolean().optional(),
  includeProjectInfoInSearch: Joi.boolean().optional(),
  filter: Joi.string().regex(genericFilterRegex).min(1).max(100).optional(),
}).when(Joi.object({ warehouseUnitId: Joi.string().required() }).unknown(), {
  then: Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
  }),
  otherwise: Joi.object({
    page: Joi.number().min(1).required(),
    limit: Joi.number().max(100).min(1).required(),
  }),
});

export const unitsUpdateSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
  ...unitsBaseSchema,
});

export const unitsDeleteSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
});

export const unitsSplitSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
  records: Joi.array()
    .items(
      Joi.object().keys({
        unitCount: Joi.number().required(),
        unitBlockStart: Joi.string().required(),
        unitBlockEnd: Joi.string().required(),
        unitOwner: Joi.string().optional(),
        unitStatus: Joi.string()
          .custom(pickListValidation('unitStatus'))
          .optional(),
        countryJurisdictionOfOwner: Joi.string()
          .custom(pickListValidation('countries', 'countryJurisdictionOfOwner'))
          .optional(),
        inCountryJurisdictionOfOwner: Joi.string().optional(),
        marketplace: Joi.string().disallow('').allow(null).optional(),
        marketplaceIdentifier: Joi.string().disallow('').allow(null).optional(),
      }),
    )
    .min(2)
    .required(),
});
