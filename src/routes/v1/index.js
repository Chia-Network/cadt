'use strict';

import express from 'express';
import { getWalletHealthResponse } from '../wallet-health.js';
import { getConfig } from '../../utils/config-loader';
import { buildHealthDiskSpacePayload } from '../../utils/disk-space.js';
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

V1Router.get('/health', (req, res) => {
  // Non-blocking: see bare /health in src/middleware.js. The shared
  // helper handles peek + transition log + async refresh.
  res.status(200).json({
    message: 'V1 API is running',
    timestamp: new Date().toISOString(),
    diskSpace: buildHealthDiskSpacePayload(),
  });
});

V1Router.get('/health/wallet', async (req, res) => {
  try {
    const wallet = (await import('../../datalayer/wallet.js')).default;
    const config = getConfig();
    const result = await getWalletHealthResponse(wallet, {
      readOnly: config.READ_ONLY === true,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(200).json({
      synced: false,
      error: `Wallet health check failed: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
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
