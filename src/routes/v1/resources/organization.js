'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

import { OrganizationController } from '../../../controllers';
import {
  importOrganizationSchema,
  newOrganizationSchema,
  resyncOrganizationSchema,
  subscribeOrganizationSchema,
  unsubscribeOrganizationSchema,
  importHomeOrganizationSchema,
  removeMirrorSchema,
  addMirrorSchema,
  getMetaDataSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const OrganizationRouter = express.Router();

OrganizationRouter.get('/', (req, res) => {
  return OrganizationController.findAll(req, res);
});

OrganizationRouter.get(
  '/organizations',
  validator.body(removeMirrorSchema),
  (req, res) => {
    return OrganizationController.removeMirror(req, res);
  },
);

OrganizationRouter.delete('/', (req, res) => {
  return OrganizationController.resetHomeOrg(req, res);
});

OrganizationRouter.post(
  '/',
  validator.body(newOrganizationSchema),
  (req, res) => {
    return OrganizationController.create(req, res);
  },
);

OrganizationRouter.post('/create', (req, res) => {
  return OrganizationController.createV2(req, res);
});

OrganizationRouter.put('/edit', (req, res) => {
  return OrganizationController.editHomeOrg(req, res);
});

OrganizationRouter.put(
  '/',
  validator.body(importHomeOrganizationSchema),
  (req, res) => {
    return OrganizationController.importHomeOrg(req, res);
  },
);

OrganizationRouter.put(
  '/import',
  validator.body(importOrganizationSchema),
  (req, res) => {
    return OrganizationController.importOrg(req, res);
  },
);

OrganizationRouter.delete('/import', (req, res) => {
  return OrganizationController.deleteImportedOrg(req, res);
});

OrganizationRouter.put(
  '/subscribe',
  validator.body(subscribeOrganizationSchema),
  (req, res) => {
    return OrganizationController.subscribeToOrganization(req, res);
  },
);

OrganizationRouter.put(
  '/unsubscribe',
  validator.body(unsubscribeOrganizationSchema),
  (req, res) => {
    return OrganizationController.unsubscribeToOrganization(req, res);
  },
);

OrganizationRouter.put(
  '/resync',
  validator.body(resyncOrganizationSchema),
  (req, res) => {
    return OrganizationController.resyncOrganization(req, res);
  },
);

OrganizationRouter.post(
  '/mirror',
  validator.body(addMirrorSchema),
  (req, res) => {
    return OrganizationController.addMirror(req, res);
  },
);

OrganizationRouter.get(
  '/metadata',
  validator.query(getMetaDataSchema),
  (req, res) => {
    return OrganizationController.getMetaData(req, res);
  },
);

OrganizationRouter.post('/metadata', (req, res) => {
  return OrganizationController.addMetadata(req, res);
});

export { OrganizationRouter };
