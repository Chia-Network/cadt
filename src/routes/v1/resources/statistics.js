'use strict';

import express from 'express';

import { StatisticsController } from '../../../controllers';
import {
  projectsStatisticsGetQuerySchema,
  tonsCo2StatisticsGetQuerySchema,
} from '../../../validations/statistics.validations.js';
import joiExpress from 'express-joi-validation';

const validator = joiExpress.createValidator({ passError: true });

const StatisticsRouter = express.Router();

StatisticsRouter.get(
  '/projects',
  validator.query(projectsStatisticsGetQuerySchema),
  (req, res) => {
    return StatisticsController.projects(req, res);
  },
);

StatisticsRouter.get(
  '/tonsCo2',
  validator.query(tonsCo2StatisticsGetQuerySchema),
  (req, res) => {
    return StatisticsController.tonsCo2(req, res);
  },
);

StatisticsRouter.get('/issuedCarbonByMethodology', (req, res) => {
  return StatisticsController.issuedCarbonByMethodology(req, res);
});

export { StatisticsRouter };
