'use strict';

import express from 'express';
import { UnitController } from '../../../controllers';
const UnitRouter = express.Router();

UnitRouter.get('/', (req, res) => {
  return req.query.id
    ? UnitController.findOne(req, res)
    : UnitController.findAll(req, res);
});

UnitRouter.post('/', UnitController.create);
UnitRouter.put('/', UnitController.update);
UnitRouter.delete('/', UnitController.destroy);

export { UnitRouter };
