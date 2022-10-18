'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import { StagingController } from '../../../controllers';

import {
  stagingDeleteSchema,
  stagingGetQuerySchema,
  stagingRetrySchema,
  commitStagingSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const StagingRouter = express.Router();

StagingRouter.get('/', validator.query(stagingGetQuerySchema), (req, res) => {
  return StagingController.findAll(req, res);
});

StagingRouter.get('/offer', (req, res) => {
  return StagingController.generateOfferFile(req, res);
});

StagingRouter.put('/', (req, res) => {
  return StagingController.editRecord(req, res);
});

StagingRouter.delete(
  '/',
  validator.body(stagingDeleteSchema),
  StagingController.destroy,
);

StagingRouter.post('/retry', validator.body(stagingRetrySchema), (req, res) => {
  return StagingController.retryRecrod(req, res);
});

StagingRouter.post(
  '/commit',
  validator.body(commitStagingSchema),
  StagingController.commit,
);

// Empty entire stagin table
StagingRouter.delete('/clean', StagingController.clean);

StagingRouter.get('/hasPendingTransactions', (req, res) => {
  return StagingController.hasPendingTransactions(req, res);
});

export { StagingRouter };
