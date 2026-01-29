'use strict';

import express from 'express';
import multer from 'multer';
import * as OrganizationsV2Controller from '../../../controllers/v2/organizations-v2.controller.js';

const OrganizationsV2Router = express.Router();

// Configure multer for file uploads (icon)
const upload = multer({ storage: multer.memoryStorage() });

// Route ordering: More specific routes MUST come before less specific routes
// This prevents Express from matching the wrong route

// 1. GET /v2/organizations/status - Get home org sync status (MUST be before /)
OrganizationsV2Router.get('/status', (req, res) => {
  return OrganizationsV2Controller.homeOrgSyncStatus(req, res);
});

// 2. POST /v2/organizations/upgrade - Upgrade from V1 to V2 (MUST be before /)
OrganizationsV2Router.post('/upgrade', (req, res) => {
  return OrganizationsV2Controller.upgrade(req, res);
});

// 3. PUT /v2/organizations/edit - Edit home organization (name and/or icon) (MUST be before /)
OrganizationsV2Router.put('/edit', upload.single('file'), (req, res) => {
  return OrganizationsV2Controller.editHomeOrg(req, res);
});

// 4. GET /v2/organizations/metadata - Get metadata for organization (MUST be before /)
OrganizationsV2Router.get('/metadata', (req, res) => {
  return OrganizationsV2Controller.getMetaData(req, res);
});

// 5. POST /v2/organizations/metadata - Add metadata to home organization (MUST be before /)
OrganizationsV2Router.post('/metadata', (req, res) => {
  return OrganizationsV2Controller.addMetadata(req, res);
});

// 6. POST /v2/organizations/sync - Sync organization metadata (MUST be before /)
OrganizationsV2Router.post('/sync', (req, res) => {
  return OrganizationsV2Controller.sync(req, res);
});

// 7. POST /v2/organizations/mirror - Add mirror for a store (MUST be before /)
OrganizationsV2Router.post('/mirror', (req, res) => {
  return OrganizationsV2Controller.addMirror(req, res);
});

// 8. POST /v2/organizations/remove-mirror - Remove mirror for a store (MUST be before /)
OrganizationsV2Router.post('/remove-mirror', (req, res) => {
  return OrganizationsV2Controller.removeMirror(req, res);
});

// 9. PUT /v2/organizations/subscribe - Subscribe to organization (MUST be before /)
OrganizationsV2Router.put('/subscribe', (req, res) => {
  return OrganizationsV2Controller.subscribeToOrganization(req, res);
});

// 10. PUT /v2/organizations/unsubscribe - Unsubscribe from organization (MUST be before /)
OrganizationsV2Router.put('/unsubscribe', (req, res) => {
  return OrganizationsV2Controller.unsubscribeFromOrganization(req, res);
});

// 11. PUT /v2/organizations/resync - Resync organization (MUST be before /)
OrganizationsV2Router.put('/resync', (req, res) => {
  return OrganizationsV2Controller.resyncOrganization(req, res);
});

// 12. GET /v2/organizations/creation-status - Get organization creation status (MUST be before /)
OrganizationsV2Router.get('/creation-status', (req, res) => {
  return OrganizationsV2Controller.getCreationStatus(req, res);
});

// 13. DELETE /v2/organizations/:orgUid - Delete organization (MUST be before /)
OrganizationsV2Router.delete('/:orgUid', (req, res) => {
  return OrganizationsV2Controller.deleteOrganization(req, res);
});

// 14. Catch-all routes (MUST be last)
// GET /v2/organizations - Get all organizations
OrganizationsV2Router.get('/', (req, res) => {
  return OrganizationsV2Controller.findAll(req, res);
});

// POST /v2/organizations - Create V2 home org (new users)
OrganizationsV2Router.post('/', upload.single('file'), (req, res) => {
  return OrganizationsV2Controller.create(req, res);
});

// PUT /v2/organizations - Import organization from datalayer
OrganizationsV2Router.put('/', (req, res) => {
  return OrganizationsV2Controller.importOrganization(req, res);
});

export { OrganizationsV2Router };

