'use strict';

import express from 'express';
import Joi from 'joi';
import { UnitController } from '../../../controllers';
import joiExpress from 'express-joi-validation';

const validator = joiExpress.createValidator({});
const UnitRouter = express.Router();

const querySchema = Joi.object({
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

UnitRouter.get('/', (req, res) => {
  return req.query.id
    ? UnitController.findOne(req, res)
    : UnitController.findAll(req, res);
});

UnitRouter.post('/', validator.query(querySchema), UnitController.create);
UnitRouter.put('/', validator.query(querySchema), UnitController.update);
UnitRouter.delete('/', UnitController.destroy);

export { UnitRouter };
