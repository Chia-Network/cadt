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
  unitBlockStart: Joi.string().required(),
  unitBlockEnd: Joi.string().required(),
  countryJuridictionOfOwner: Joi.string().required(),
  inCountryJuridictionOfOwner: Joi.string().required(),
  intendedBuyerOrgUid: Joi.string().optional(),
  tags: Joi.string().optional(),
  tokenIssuanceHash: Joi.string().required(),
  marketplaceIdentifier: Joi.string().optional(),
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
