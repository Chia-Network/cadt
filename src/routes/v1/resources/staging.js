'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import { StagingController } from '../../../controllers';

import { stagingDeleteSchema } from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const StagingRouter = express.Router();

StagingRouter.get('/', (req, res) => {
  return StagingController.findAll(req, res);
});

StagingRouter.delete(
  '/',
  validator.body(stagingDeleteSchema),
  StagingController.destroy,
);

StagingRouter.post('/commit', StagingController.commit);

// Empty entire stagin table
StagingRouter.delete('/clean', StagingController.clean);

export { StagingRouter };
