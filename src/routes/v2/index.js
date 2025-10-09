'use strict';

import express from 'express';
const V2Router = express.Router();

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
} from './resources';

V2Router.use('/projects', ProjectRouter);
V2Router.use('/units', UnitRouter);
V2Router.use('/staging', StagingRouter);
V2Router.use('/organizations', OrganizationRouter);
V2Router.use('/issuances', IssuanceRouter);
V2Router.use('/labels', LabelRouter);
V2Router.use('/audit', AuditRouter);
V2Router.use('/governance', GovernanceRouter);
V2Router.use('/filestore', FileStoreRouter);
V2Router.use('/offer', OfferRouter);

export { V2Router };
