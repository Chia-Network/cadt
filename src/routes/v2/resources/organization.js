'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import multer from 'multer';

import { OrganizationController } from '../../../controllers';
import {
  importOrganizationSchema,
  newOrganizationWithIconSchema,
  resyncOrganizationSchema,
  subscribeOrganizationSchema,
  unsubscribeOrganizationSchema,
  removeMirrorSchema,
  addMirrorSchema,
  getMetaDataSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const OrganizationRouter = express.Router();
const upload = multer();

OrganizationRouter.get('/', (req, res) => {
  return OrganizationController.findAll(req, res);
});

OrganizationRouter.post(
  '/remove-mirror',
  validator.body(removeMirrorSchema),
  (req, res) => {
    return OrganizationController.removeMirror(req, res);
  },
);

OrganizationRouter.post('/sync', (req, res) => {
  return OrganizationController.sync(req, res);
});

OrganizationRouter.delete('/:orgUid', (req, res) => {
  return OrganizationController.deleteOrganization(req, res);
});

OrganizationRouter.post(
  '/',
  validator.body(newOrganizationWithIconSchema),
  (req, res) => {
    return OrganizationController.create(req, res);
  },
);

OrganizationRouter.post('/create', upload.single('file'), (req, res) => {
  return OrganizationController.createV2(req, res);
});

OrganizationRouter.put('/edit', upload.single('file'), (req, res) => {
  return OrganizationController.editHomeOrg(req, res);
});

OrganizationRouter.put(
  '/',
  validator.body(importOrganizationSchema),
  (req, res) => {
    return OrganizationController.importOrganization(req, res);
  },
);

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
    return OrganizationController.unsubscribeFromOrganization(req, res);
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

OrganizationRouter.get('/status', (req, res) => {
  return OrganizationController.homeOrgSyncStatus(req, res);
});

export { OrganizationRouter };
