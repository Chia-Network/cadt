'use strict';

import express from 'express';

import { LabelController } from '../../../controllers';

const LabelRouter = express.Router();

LabelRouter.get('/', (req, res) => {
  return LabelController.findAll(req, res);
});

export { LabelRouter };
