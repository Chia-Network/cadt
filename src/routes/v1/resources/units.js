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
  })
  .with('page', 'limit');

UnitRouter.get('/', validator.query(querySchema), (req, res) => {
  return req.query.id
    ? UnitController.findOne(req, res)
    : UnitController.findAll(req, res);
});

const bodySchema = Joi.object({
  buyer: Joi.string().required(),
  registry: Joi.string().required(),
  blockIdentifier: Joi.string().required(),
  identifier: Joi.string().required(),
  qualificationId: Joi.number().required(),
  unitType: Joi.string().required(),
  unitCount: Joi.number().required(),
  unitStatus: Joi.string().required(),
  unitStatusDate: Joi.string().required(),
  transactionType: Joi.string().required(),
  unitIssuanceLocation: Joi.string().required(),
  unitLink: Joi.string().required(),
  correspondingAdjustment: Joi.string().required(),
  unitTag: Joi.string().required(),
  vintageId: Joi.number().required(),
});

UnitRouter.post('/', validator.body(bodySchema), UnitController.create);

const bodySchemaUpdate = {
  uuid: Joi.string().required(),
  ...bodySchema,
};

UnitRouter.put('/', validator.body(bodySchemaUpdate), UnitController.update);

const bodySchemaDelete = {
  uuid: Joi.string().required(),
};

UnitRouter.delete(
  '/',
  validator.body(bodySchemaDelete),
  UnitController.destroy,
);

const splitSchema = Joi.object({
  unitUid: Joi.string().required(),
  records: Joi.array()
    .items(
      Joi.object().keys({
        unitCount: Joi.number().required(),
        orgUid: Joi.string().optional(),
      }),
    )
    .min(2)
    .max(2),
});

UnitRouter.post('/split', UnitController.split);

export { UnitRouter };
