'use strict';

import express from 'express';

import { IssuanceController } from '../../../controllers';

const IssuanceRouter = express.Router();

IssuanceRouter.get('/', (req, res) => {
  return IssuanceController.findAll(req, res);
});

export { IssuanceRouter };
