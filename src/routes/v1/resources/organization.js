'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

import { OrganizationController } from '../../../controllers';
import { newOrganizationSchema } from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const OrganizationRouter = express.Router();

OrganizationRouter.get('/', (req, res) => {
  return OrganizationController.findAll(req, res);
});

OrganizationRouter.post(
  '/',
  validator.body(newOrganizationSchema),
  (req, res) => {
    return OrganizationController.create(req, res);
  },
);

OrganizationRouter.put('/', (req, res) => {
  return OrganizationController.importOrg(req, res);
});

export { OrganizationRouter };
