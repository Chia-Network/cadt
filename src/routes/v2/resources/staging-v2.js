'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import * as StagingV2Controller from '../../../controllers/v2/staging-v2.controller.js';
import { stagingRetryV2Schema } from '../../../validations/v2/staging-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const StagingV2Router = express.Router();

// GET /v2/staging - findAll (with query params: page, limit, type, table)
StagingV2Router.get('/', (req, res) => {
  return StagingV2Controller.findAll(req, res);
});

// GET /v2/staging/pending - hasPendingCommits
StagingV2Router.get('/pending', (req, res) => {
  return StagingV2Controller.hasPendingCommits(req, res);
});

// GET /v2/staging/offer - generateOfferFile (must be before generic routes)
StagingV2Router.get('/offer', (req, res) => {
  return StagingV2Controller.generateOfferFile(req, res);
});

// POST /v2/staging/commit - commit
StagingV2Router.post('/commit', (req, res) => {
  return StagingV2Controller.commit(req, res);
});

// DELETE /v2/staging - destroy
StagingV2Router.delete('/', (req, res) => {
  return StagingV2Controller.destroy(req, res);
});

// DELETE /v2/staging/clean - clean
StagingV2Router.delete('/clean', (req, res) => {
  return StagingV2Controller.clean(req, res);
});

// PUT /v2/staging - editRecord
StagingV2Router.put('/', (req, res) => {
  return StagingV2Controller.editRecord(req, res);
});

// POST /v2/staging/retry - retryRecord
StagingV2Router.post(
  '/retry',
  validator.body(stagingRetryV2Schema),
  (req, res) => {
    return StagingV2Controller.retryRecord(req, res);
  },
);

export { StagingV2Router };

