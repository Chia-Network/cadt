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
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const OrganizationRouter = express.Router();

OrganizationRouter.get('/', (req, res) => {
  return OrganizationController.findAll(req, res);
});

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

OrganizationRouter.put('/', (req, res) => {
  return OrganizationController.importOrg(req, res);
});

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

export { OrganizationRouter };
