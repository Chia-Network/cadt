'use strict';

import express from 'express';
const V1Router = express.Router();

import {
  ProjectRouter,
  UnitRouter,
  StagingRouter,
  OrganizationRouter,
  IssuanceRouter,
  LabelRouter,
  AuditRouter,
  GovernanceRouter,
  FileStoreRouter,
  OfferRouter,
} from './resources/index.js';

V1Router.use('/projects', ProjectRouter);
V1Router.use('/units', UnitRouter);
V1Router.use('/staging', StagingRouter);
V1Router.use('/organizations', OrganizationRouter);
V1Router.use('/issuances', IssuanceRouter);
V1Router.use('/labels', LabelRouter);
V1Router.use('/audit', AuditRouter);
V1Router.use('/governance', GovernanceRouter);
V1Router.use('/filestore', FileStoreRouter);
V1Router.use('/offer', OfferRouter);

export { V1Router };
