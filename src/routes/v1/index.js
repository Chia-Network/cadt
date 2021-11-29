'use strict';

import express from 'express';
const V1Router = express.Router();

import {
  ProjectRouter,
  UnitRouter,
  CoBenifetRouter,
  LocationRouter,
  QualificationRouter,
  RatingRouter,
  VintageRouter,
  RelatedProjectRouter,
} from './resources';

V1Router.use('/projects', ProjectRouter);
V1Router.use('/units', UnitRouter);
V1Router.use('/co-benifets', CoBenifetRouter);
V1Router.use('/locations', LocationRouter);
V1Router.use('/qualifications', QualificationRouter);
V1Router.use('/ratings', RatingRouter);
V1Router.use('/vintages', VintageRouter);
V1Router.use('/related-projects', RelatedProjectRouter);

export { V1Router };
