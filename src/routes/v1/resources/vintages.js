'use strict';

import express from 'express';

import { VintageController } from '../../../controllers';

const VintageRouter = express.Router();

VintageRouter.get('/', (req, res) => {
  return VintageController.findAll(req, res);
});

export { VintageRouter };
