import Joi from 'joi';
import { transformSerialNumberBlock } from '../utils/helpers';
import { issuanceSchema } from './issuances.validation';
import { labelSchema } from './labels.validations';

const customSerialNumberValidator = (obj, helper) => {
  const { serialNumberBlock, serialNumberPattern } = obj;

  // eslint-disable-next-line no-unused-vars
  const [_, __, unitCount] = transformSerialNumberBlock(
    serialNumberBlock,
    new RegExp(serialNumberPattern),
  );

  if (!unitCount) {
    return helper.message(
      `serialNumberBlock could not be parsed, invalid pattern found`,
    );
  }

  if (unitCount < 1) {
    return helper.message(
      `serialNumberBlock must have a positive non-zero number, received ${unitCount}`,
    );
  }
  return obj;
};

const unitsBaseSchema = {
  // warehouseUnitId - derived upon unit creation
  // issuanceId - derived upon unit creation
  // orgUid - derived upon unit creation
  projectLocationId: Joi.string().required(),
  unitOwner: Joi.string().required(),
  countryJurisdictionOfOwner: Joi.string().required(),
  inCountryJurisdictionOfOwner: Joi.string().required(),
  //'inCountryJurisdictionOfOwner' should be optional.
  // must be in the form ABC123-XYZ456
  serialNumberBlock: Joi.string().required(),
  serialNumberPattern: Joi.string().required().messages({
    'any.required':
      'serialNumberPattern is required. This pattern must be a regex expression with 2 match groups to match block start and block end. Example: [.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$ that matches ABC1000-ABC1010 TODO: ADD LINK HERE FOR DOCUMENTATION',
  }),
  // match 4 digit year
  vintageYear: Joi.number().integer().min(1900).max(3000),
  //'vintageYear' should be required.
  unitType: Joi.string().valid('heard reduction', 'removal').required(),
  marketplace: Joi.string().optional(),
  marketplaceLink: Joi.string().optional(),
  marketplaceIdentifier: Joi.string().optional(),
  unitTags: Joi.string().allow('').optional(),
  unitStatus: Joi.string().valid('Held', 'For Sale', 'Retired').required(),
  unitStatusReason: Joi.string().optional(),
  //'unitStatusReason' should have additional validation based on entry in 'unitStatus'. If user enters "cancelled" or "retired", then 'unitStatusReason' field becomes required.
  unitRegistryLink: Joi.string().required(),
  correspondingAdjustmentDeclaration: Joi.string()
    .valid('Commited', 'Not Required', 'Unknown')
    .required(),
  correspondingAdjustmentStatus: Joi.string()
    .valid('Unknown', 'Not Started', 'Pending')
    .required(),
  issuance: issuanceSchema.optional(),
  labels: Joi.array().items(labelSchema).optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
};

export const unitsPostSchema = Joi.object({
  ...unitsBaseSchema,
}).custom(customSerialNumberValidator);

export const unitsGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    search: Joi.string(),
    warehouseUnitId: Joi.string(),
    columns: Joi.array().items(Joi.string()).single(),
    orgUid: Joi.string(),
    xls: Joi.boolean(),
  })
  .with('page', 'limit');

export const unitsUpdateSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
  ...unitsBaseSchema,
}).custom(customSerialNumberValidator);

export const unitsDeleteSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
});

export const unitsSplitSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
  records: Joi.array()
    .items(
      Joi.object().keys({
        unitCount: Joi.number().required(),
        unitOwner: Joi.string().optional(),
      }),
    )
    .min(2)
    .max(2),
});
