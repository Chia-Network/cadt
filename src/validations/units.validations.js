import Joi from 'joi';

import { issuanceSchema } from './issuances.validation';
import { labelSchema } from './labels.validations';

import { pickListValidation } from '../utils/validation-utils';

const unitsBaseSchema = {
  // warehouseUnitId - derived upon unit creation
  // issuanceId - derived upon unit creation
  // orgUid - derived upon unit creation
  projectLocationId: Joi.string().optional(),
  unitOwner: Joi.string(),
  countryJurisdictionOfOwner: Joi.string()
    .custom(pickListValidation('countries', 'countryJurisdictionOfOwner'))
    .required(),
  inCountryJurisdictionOfOwner: Joi.string().optional(),
  unitBlockStart: Joi.string().required(),
  unitBlockEnd: Joi.string().required(),
  unitCount: Joi.number().integer().required(),
  // match 4 digit year
  vintageYear: Joi.number().integer().min(1900).max(3000).required(),
  unitType: Joi.string().custom(pickListValidation('unitType')).required(),
  marketplace: Joi.string().optional(),
  marketplaceLink: Joi.string().optional(),
  marketplaceIdentifier: Joi.string().optional(),
  unitTags: Joi.string().allow('').optional(),
  unitStatus: Joi.string().custom(pickListValidation('unitStatus')).required(),
  unitStatusReason: Joi.string().when('unitStatus', {
    is: Joi.exist().valid('cancelled', 'retired'),
    then: Joi.required(),
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
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
};

export const unitsPostSchema = Joi.object({
  ...unitsBaseSchema,
});

export const unitsGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    search: Joi.string(),
    warehouseUnitId: Joi.string(),
    columns: Joi.array().items(Joi.string()).single(),
    orgUid: Joi.string(),
    order: Joi.string().valid('SERIALNUMBER', 'ASC', 'DESC'),
    xls: Joi.boolean(),
  })
  .with('page', 'limit');

export const unitsUpdateSchema = Joi.object({
  warehouseUnitId: Joi.string().optional(),
  projectLocationId: Joi.string().optional(),
  unitOwner: Joi.string(),
  countryJurisdictionOfOwner: Joi.string()
    .custom(pickListValidation('countries', 'countryJurisdictionOfOwner')),
  inCountryJurisdictionOfOwner: Joi.string().optional(),
  unitBlockStart: Joi.string().optional(),
  unitBlockEnd: Joi.string().optional(),
  unitCount: Joi.number().integer().optional(),
  // match 4 digit year
  vintageYear: Joi.number().integer().min(1900).max(3000).optional(),
  unitType: Joi.string().custom(pickListValidation('unitType')).optional(),
  marketplace: Joi.string().optional(),
  marketplaceLink: Joi.string().optional(),
  marketplaceIdentifier: Joi.string().optional(),
  unitTags: Joi.string().allow('').optional(),
  unitStatus: Joi.string().custom(pickListValidation('unitStatus')).optional(),
  unitStatusReason: Joi.string().when('unitStatus', {
    is: Joi.exist().valid('cancelled', 'retired'),
    then: Joi.required(),
  }),
  unitRegistryLink: Joi.string().optional(),
  correspondingAdjustmentDeclaration: Joi.string()
    .custom(pickListValidation('correspondingAdjustmentDeclaration'))
    .optional(),
  correspondingAdjustmentStatus: Joi.string()
    .custom(pickListValidation('correspondingAdjustmentStatus'))
    .optional(),
  issuance: issuanceSchema.optional(),
  labels: Joi.array().items(labelSchema).optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
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
        countryJurisdictionOfOwner: Joi.string()
          .custom(pickListValidation('countries', 'countryJurisdictionOfOwner'))
          .optional(),
        inCountryJurisdictionOfOwner: Joi.string().optional(),
      }),
    )
    .min(2)
    .required(),
});
