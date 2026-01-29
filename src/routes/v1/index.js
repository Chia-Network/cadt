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
} from './resources';

// Simple health check for V1 - doesn't require wallet or datalayer to be synced
// This allows tests to verify V1 API is enabled without waiting for Chia services
V1Router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'V1 API is running',
    timestamp: new Date().toISOString(),
  });
});

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
