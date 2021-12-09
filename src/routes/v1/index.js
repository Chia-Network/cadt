'use strict';

import express from 'express';
const V1Router = express.Router();

import {
  ProjectRouter,
  UnitRouter,
  CoBenefitRouter,
  LocationRouter,
  QualificationRouter,
  RatingRouter,
  VintageRouter,
  RelatedProjectRouter,
  StagingRouter,
} from './resources';

V1Router.use('/projects', ProjectRouter);
V1Router.use('/units', UnitRouter);
V1Router.use('/co-benefits', CoBenefitRouter);
V1Router.use('/locations', LocationRouter);
V1Router.use('/qualifications', QualificationRouter);
V1Router.use('/ratings', RatingRouter);
V1Router.use('/vintages', VintageRouter);
V1Router.use('/related-projects', RelatedProjectRouter);
V1Router.use('/staging', StagingRouter);

export { V1Router };
