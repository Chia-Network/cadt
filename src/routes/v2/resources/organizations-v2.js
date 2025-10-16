import express from 'express';
import { OrganizationsV2Controller } from '../../../controllers/v2/index.js';

const OrganizationsV2Router = express.Router();

// Create V2 home organization
OrganizationsV2Router.post('/', (req, res) => {
  return OrganizationsV2Controller.create(req, res);
});

// Get V2 home organization
OrganizationsV2Router.get('/home', (req, res) => {
  return OrganizationsV2Controller.getHomeOrg(req, res);
});

// Get all V2 organizations
OrganizationsV2Router.get('/', (req, res) => {
  return OrganizationsV2Controller.findAll(req, res);
});

// Get V2 organization by UID
OrganizationsV2Router.get('/:orgUid', (req, res) => {
  return OrganizationsV2Controller.findOne(req, res);
});

// Subscribe to V2 organization
OrganizationsV2Router.post('/:orgUid/subscribe', (req, res) => {
  return OrganizationsV2Controller.subscribe(req, res);
});

// Update V2 organization
OrganizationsV2Router.put('/:orgUid', (req, res) => {
  return OrganizationsV2Controller.update(req, res);
});

export { OrganizationsV2Router };

