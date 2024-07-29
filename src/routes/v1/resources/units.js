'use strict';

import express from 'express';
import { UnitController } from '../../../controllers/index.js';
import joiExpress from 'express-joi-validation';
import multer from 'multer';

import {
  unitsGetQuerySchema,
  unitsPostSchema,
  unitsUpdateSchema,
  unitsDeleteSchema,
  unitsSplitSchema,
} from '../../../validations/index.js';

const validator = joiExpress.createValidator({ passError: true });
const UnitRouter = express.Router();
const upload = multer();

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

UnitRouter.put('/xlsx', upload.single('xlsx'), UnitController.updateFromXLS);

export { UnitRouter };
