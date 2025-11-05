'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import * as GovernanceV2Controller from '../../../controllers/v2/governance-v2.controller.js';
import {
  setOrgListSchema,
  governancePickListSchema,
} from '../../../validations/governance.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const GovernanceV2Router = express.Router();

// Read routes for governance
GovernanceV2Router.get('/', GovernanceV2Controller.findAll);
GovernanceV2Router.get('/exists', GovernanceV2Controller.isCreated);
GovernanceV2Router.get('/sync', GovernanceV2Controller.sync);
GovernanceV2Router.get('/meta/orgList', GovernanceV2Controller.findOrgList);
GovernanceV2Router.get('/meta/pickList', GovernanceV2Controller.findPickList);
GovernanceV2Router.get('/meta/glossary', GovernanceV2Controller.findGlossary);

// Create governance body endpoint
GovernanceV2Router.post('/', GovernanceV2Controller.createGoveranceBody);

// Update endpoints
GovernanceV2Router.post(
  '/meta/orgList',
  validator.body(setOrgListSchema),
  (req, res) => {
    return GovernanceV2Controller.setDefaultOrgList(req, res);
  },
);

GovernanceV2Router.post(
  '/meta/pickList',
  validator.body(governancePickListSchema),
  (req, res) => {
    return GovernanceV2Controller.setPickList(req, res);
  },
);

GovernanceV2Router.post('/meta/glossary', (req, res) => {
  return GovernanceV2Controller.setGlossary(req, res);
});

export { GovernanceV2Router };

