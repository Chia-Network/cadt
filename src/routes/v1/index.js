'use strict';

import express from 'express';
const V1Router = express.Router();

import {
  ProjectRouter,
  UnitRouter,
  StagingRouter,
  OrganizationRouter,
  IssuanceRouter,
} from './resources';

V1Router.use('/projects', ProjectRouter);
V1Router.use('/units', UnitRouter);
V1Router.use('/staging', StagingRouter);
V1Router.use('/organizations', OrganizationRouter);
V1Router.use('/issuances', IssuanceRouter);

export { V1Router };
