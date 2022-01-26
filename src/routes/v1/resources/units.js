'use strict';

import express from 'express';
import { UnitController } from '../../../controllers';
import joiExpress from 'express-joi-validation';

import {
  unitsGetQuerySchema,
  unitsPostSchema,
  unitsUpdateSchema,
  unitsDeleteSchema,
  unitsSplitSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const UnitRouter = express.Router();

UnitRouter.get('/', validator.query(unitsGetQuerySchema), (req, res) => {
  return req.query.warehouseUnitId
    ? UnitController.findOne(req, res)
    : UnitController.findAll(req, res);
});

UnitRouter.post('/', validator.body(unitsPostSchema), UnitController.create);
UnitRouter.put('/', validator.body(unitsUpdateSchema), UnitController.update);

UnitRouter.delete(
  '/',
  validator.body(unitsDeleteSchema),
  UnitController.destroy,
);

UnitRouter.post(
  '/split',
  validator.body(unitsSplitSchema),
  UnitController.split,
);

UnitRouter.post('/batch', UnitController.batchUpload);

export { UnitRouter };
