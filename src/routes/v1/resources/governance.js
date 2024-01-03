'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

import { GovernanceController } from '../../../controllers';
import {
  governanceSubscribeSchema,
  setOrgListSchema,
  governancePickListSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const GovernanceRouter = express.Router();

GovernanceRouter.get('/exists', (req, res) => {
  return GovernanceController.isCreated(req, res);
});

GovernanceRouter.get('/', (req, res) => {
  return GovernanceController.findAll(req, res);
});

GovernanceRouter.get('/picklistpage', (req, res) => {
  return GovernanceController.renderGovernance(req, res);
});

GovernanceRouter.get('/sync', (req, res) => {
  return GovernanceController.sync(req, res);
});

GovernanceRouter.get('/meta/orgList', (req, res) => {
  return GovernanceController.findOrgList(req, res);
});

GovernanceRouter.get('/meta/pickList', (req, res) => {
  return GovernanceController.findPickList(req, res);
});

GovernanceRouter.get('/meta/glossary', (req, res) => {
  return GovernanceController.findGlossary(req, res);
});

GovernanceRouter.post('/', (req, res) => {
  return GovernanceController.createGoveranceBody(req, res);
});

GovernanceRouter.post(
  '/meta/orgList',
  validator.body(setOrgListSchema),
  (req, res) => {
    return GovernanceController.setDefaultOrgList(req, res);
  },
);

GovernanceRouter.post(
  '/meta/pickList',
  validator.body(governancePickListSchema),
  (req, res) => {
    return GovernanceController.setPickList(req, res);
  },
);

GovernanceRouter.post('/meta/glossary', (req, res) => {
  return GovernanceController.setGlossary(req, res);
});

GovernanceRouter.post(
  '/subscribe',
  validator.body(governanceSubscribeSchema),
  (req, res) => {
    return GovernanceController.subscribeToGovernanceBody(req, res);
  },
);

export { GovernanceRouter };
