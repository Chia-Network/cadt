'use strict';

import express from 'express';
import { LocationController } from '../../../controllers';
const LocationRouter = express.Router();

LocationRouter.get('/', (req, res) => {
  return req.query.id
    ? LocationController.findOne(req, res)
    : LocationController.findAll(req, res);
});

LocationRouter.post('/', LocationController.create);
LocationRouter.put('/', LocationController.update);
LocationRouter.delete('/', LocationController.destroy);

export { LocationRouter };
