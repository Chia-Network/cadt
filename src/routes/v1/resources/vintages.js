'use strict';

import express from 'express';
import { VintageController } from '../../../controllers';
const VintageRouter = express.Router();

VintageRouter.get('/', (req, res) => {
  return req.query.id
    ? VintageController.findOne(req, res)
    : VintageController.findAll(req, res);
});

VintageRouter.post('/', VintageController.create);
VintageRouter.put('/', VintageController.update);
VintageRouter.delete('/', VintageController.destroy);

export { VintageRouter };
