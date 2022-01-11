'use strict';

import express from 'express';
import Joi from 'joi';
import { UnitController } from '../../../controllers';
import joiExpress from 'express-joi-validation';

const validator = joiExpress.createValidator({});
const UnitRouter = express.Router();

const querySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    search: Joi.string(),
    warehouseUnitId: Joi.string(),
    columns: Joi.array().items(Joi.string()).single(),
  })
  .with('page', 'limit');

UnitRouter.get('/', validator.query(querySchema), (req, res) => {
  return req.query.warehouseUnitId
    ? UnitController.findOne(req, res)
    : UnitController.findAll(req, res);
});

const baseSchema = {
  countryJuridictionOfOwner: Joi.string().required(),
  inCountryJuridictionOfOwner: Joi.string().required(),
  // must be in the form ABC123-XYZ456
  serialNumberBlock: Joi.string()
    .regex(/[.*\D]+[0-9]+[-][.*\D]+[0-9]+$/)
    .required(),
  unitIdentifier: Joi.string().required(),
  unitType: Joi.string().valid('heard reduction', 'removal').required(),
  intendedBuyerOrgUid: Joi.string().optional(),
  marketplace: Joi.string().optional(),
  tags: Joi.string().allow('').optional(),
  unitStatus: Joi.string().valid('Held', 'For Sale', 'Retired').required(),
  unitTransactionType: Joi.string().optional(),
  unitStatusReason: Joi.string().optional(),
  tokenIssuanceHash: Joi.string().required(),
  marketplaceIdentifier: Joi.string().optional(),
  unitsIssuanceLocation: Joi.string().optional(),
  unitRegistryLink: Joi.string().optional(),
  unitMarketplaceLink: Joi.string().optional(),
  cooresponingAdjustmentDeclaration: Joi.string()
    .valid('Commited', 'Not Required', 'Unknown')
    .required(),
  correspondingAdjustmentStatus: Joi.string()
    .valid('Not Started', 'Pending')
    .required(),
};

const postSchema = Joi.object({
  ...baseSchema,
});

UnitRouter.post('/', validator.body(postSchema), UnitController.create);

const updateSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
  ...baseSchema,
});

UnitRouter.put('/', validator.body(updateSchema), UnitController.update);

const deleteSchema = Joi.object({
  warehouseUnitId: Joi.string().required(),
});

UnitRouter.delete('/', validator.body(deleteSchema), UnitController.destroy);

const splitSchema = Joi.object({
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

UnitRouter.post('/split', validator.body(splitSchema), UnitController.split);

export { UnitRouter };
