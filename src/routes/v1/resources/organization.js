'use strict';

import express from 'express';

import { OrganizationController } from '../../../controllers';

const OrganizationRouter = express.Router({ passError: true });

OrganizationRouter.get('/', (req, res) => {
  return OrganizationController.findAll(req, res);
});

OrganizationRouter.post('/', (req, res) => {
  return OrganizationController.create(req, res);
});

export { OrganizationRouter };
