'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import { StagingV2Controller } from '../../../controllers/v2/staging-v2.controller.js';
import {
  stagingDeleteSchema,
  stagingGetQuerySchema,
  stagingRetrySchema,
  commitStagingSchema,
  stagingEditSchema,
} from '../../../validations/index.js';

const validator = joiExpress.createValidator({ passError: true });
const StagingV2Router = express.Router();

StagingV2Router.get('/', validator.query(stagingGetQuerySchema), (req, res) => {
  return StagingV2Controller.findAll(req, res);
});

StagingV2Router.get('/offer', (req, res) => {
  return StagingV2Controller.hasPendingCommits(req, res);
});

StagingV2Router.delete('/', validator.body(stagingDeleteSchema), (req, res) => {
  return StagingV2Controller.destroy(req, res);
});

StagingV2Router.put('/', validator.body(stagingEditSchema), (req, res) => {
  return StagingV2Controller.editRecord(req, res);
});

StagingV2Router.put('/retry', validator.body(stagingRetrySchema), (req, res) => {
  return StagingV2Controller.retryRecord(req, res);
});

StagingV2Router.post(
  '/commit',
  validator.body(commitStagingSchema),
  (req, res) => {
    return StagingV2Controller.commit(req, res);
  },
);

// Empty entire staging table
StagingV2Router.delete('/clean', (req, res) => {
  return StagingV2Controller.clean(req, res);
});

StagingV2Router.get('/hasPendingTransactions', (req, res) => {
  return StagingV2Controller.hasPendingCommits(req, res);
});

export { StagingV2Router };
