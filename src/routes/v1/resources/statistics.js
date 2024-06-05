'use strict';

import express from 'express';

import { StatisticsController } from '../../../controllers';

const StatisticsRouter = express.Router();

StatisticsRouter.get('/projects', (req, res) => {
  return StatisticsController.projects(req, res);
});

StatisticsRouter.get('/tonsCo2', (req, res) => {
  return StatisticsController.tonsCo2(req, res);
});

StatisticsRouter.get('/carbonByMethodology', (req, res) => {
  return StatisticsController.carbonByMethodology(req, res);
});

export { StatisticsRouter };
