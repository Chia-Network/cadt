import express from 'express';
import joiExpress from 'express-joi-validation';
import { GovernanceV2Controller } from '../../../controllers/v2/index.js';
import {
  governanceSubscribeSchema,
  setOrgListSchema,
  governancePickListSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const GovernanceV2Router = express.Router();

// Check if V2 governance body exists
GovernanceV2Router.get('/exists', (req, res) => {
  return GovernanceV2Controller.isCreated(req, res);
});

// Get all V2 governance data
GovernanceV2Router.get('/', (req, res) => {
  return GovernanceV2Controller.findAll(req, res);
});

// Sync V2 governance data
GovernanceV2Router.get('/sync', (req, res) => {
  return GovernanceV2Controller.sync(req, res);
});

// Get V2 picklist
GovernanceV2Router.get('/picklist', (req, res) => {
  return GovernanceV2Controller.findPickList(req, res);
});

// Get V2 glossary
GovernanceV2Router.get('/glossary', (req, res) => {
  return GovernanceV2Controller.findGlossary(req, res);
});

// Create V2 governance body
GovernanceV2Router.post('/', (req, res) => {
  return GovernanceV2Controller.createGoveranceBody(req, res);
});

// Set V2 organization list
GovernanceV2Router.post(
  '/meta/orgList',
  validator.body(setOrgListSchema),
  (req, res) => {
    return GovernanceV2Controller.setDefaultOrgList(req, res);
  },
);

// Set V2 picklist
GovernanceV2Router.post(
  '/meta/pickList',
  validator.body(governancePickListSchema),
  (req, res) => {
    return GovernanceV2Controller.setPickList(req, res);
  },
);

// Set V2 glossary
GovernanceV2Router.post(
  '/meta/glossary',
  validator.body(governancePickListSchema),
  (req, res) => {
    return GovernanceV2Controller.setGlossary(req, res);
  },
);

export { GovernanceV2Router };

