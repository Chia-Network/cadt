'use strict';

import express from 'express';

import { LabelController } from '../../../controllers/index.js';

const LabelRouter = express.Router();

LabelRouter.get('/', (req, res) => {
  return LabelController.findAll(req, res);
});

export { LabelRouter };
