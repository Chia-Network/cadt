import Joi from 'joi';
import { transformSerialNumberBlock } from '../utils/helpers';
import { newVintageScheme, existingVintageSchema } from './vintages.validation';

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
  countryJurisdictionOfOwner: Joi.string().required(),
  inCountryJurisdictionOfOwner: Joi.string().optional(),
  // must be in the form ABC123-XYZ456
  serialNumberBlock: Joi.string().required(),
  serialNumberPattern: Joi.string().required().messages({
    'any.required':
      'serialNumberPattern is required. This pattern must be a regex expression with 2 match groups to match block start and block end. Example: [.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$ that matches ABC1000-ABC1010 TODO: ADD LINK HERE FOR DOCUMENTATION',
  }),
  unitIdentifier: Joi.string().required(),
  unitType: Joi.string().valid('heard reduction', 'removal').required(),
  intendedBuyerOrgUid: Joi.string().optional(),
  marketplace: Joi.string().optional(),
  tags: Joi.string().allow('').optional(),
  unitStatus: Joi.string().valid('Held', 'For Sale', 'Retired').required(),
  unitTransactionType: Joi.string().optional(),
  unitStatusReason: Joi.string().optional(),
  tokenIssuanceHash: Joi.string().optional(),
  marketplaceIdentifier: Joi.string().optional(),
  unitsIssuanceLocation: Joi.string().required(),
  unitRegistryLink: Joi.string().required(),
  unitMarketplaceLink: Joi.string().optional(),
  correspondingAdjustmentDeclaration: Joi.string()
    .valid('Commited', 'Not Required', 'Unknown')
    .required(),
  correspondingAdjustmentStatus: Joi.string()
    .valid('Unknown', 'Not Started', 'Pending')
    .required(),
  vintages: Joi.alternatives()
    .try(newVintageScheme, existingVintageSchema)
    .optional(),
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
        unitOwnerOrgUid: Joi.string().optional(),
      }),
    )
    .min(2)
    .max(2),
});
