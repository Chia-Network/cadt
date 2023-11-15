'use strict';

import _ from 'lodash';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { V1Router } from './routes/v1';
import { CONFIG } from './user-config';
import {
  assertChiaNetworkMatchInConfiguration,
  assertDataLayerAvailable,
  assertWalletIsAvailable,
} from './utils/data-assertions';
import packageJson from '../package.json' assert { type: 'json' };
import datalayer from './datalayer';
import { Organization } from './models';

const headerKeys = Object.freeze({
  API_VERSION_HEADER_KEY: 'x-api-version',
  CR_READY_ONLY_HEADER_KEY: 'cw-read-only',
  DATA_MODEL_VERION_HEADER_KEY: 'x-datamodel-version',
  GOVERNANCE_BODY_HEADER_KEY: 'x-governance-body',
  WALLET_SYNCED: 'x-wallet-synced',
  HOME_ORGANIZATION_SYNCED: 'x-home-org-synced',
  ALL_DATA_SYNCED: 'x-data-synced',
  SYNC_REMAINING: 'x-sync-remaining',
});

const app = express();

app.use(
  cors({
    exposedHeaders: Object.values(headerKeys).join(','),
  }),
);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Common assertions on every endpoint
app.use(async function (req, res, next) {
  try {
    await assertChiaNetworkMatchInConfiguration();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    next();
  } catch (err) {
    res.status(400).json({
      message: 'Chia Exception',
      error: err.message,
      success: false,
    });
  }
});

app.use(function (req, res, next) {
  res.set('Cache-control', 'no-store');
  next();
});

// Add optional API key if set in .env file
app.use(function (req, res, next) {
  if (CONFIG().CADT.API_KEY && CONFIG().CADT.API_KEY !== '') {
    const apikey = req.header('x-api-key');
    if (CONFIG().CADT.API_KEY === apikey) {
      next();
    } else {
      res.status(403).json({ message: 'API key not found', success: false });
    }
  } else {
    next();
  }
});

app.use(function (req, res, next) {
  if (CONFIG().CADT.READ_ONLY) {
    res.setHeader(headerKeys.CR_READY_ONLY_HEADER_KEY, CONFIG().CADT.READ_ONLY);
  } else {
    res.setHeader(headerKeys.CR_READY_ONLY_HEADER_KEY, false);
  }

  next();
});

app.use(function (req, res, next) {
  res.setHeader(
    headerKeys.GOVERNANCE_BODY_HEADER_KEY,
    CONFIG().CADT.IS_GOVERNANCE_BODY,
  );
  next();
});

app.use(function (req, res, next) {
  const version = packageJson.version;
  res.setHeader(headerKeys.API_VERSION_HEADER_KEY, version);

  const majorVersion = version.split('.')[0];
  res.setHeader(headerKeys.DATA_MODEL_VERION_HEADER_KEY, `v${majorVersion}`);

  next();
});

app.use(async function (req, res, next) {
  if (process.env.NODE_ENV !== 'test') {
    // If the home organization is syncing, then we treat all requests as read-only
    const homeOrg = await Organization.getHomeOrg();

    if (homeOrg) {
      if (req.method !== 'GET' && !homeOrg.synced) {
        res.status(400).json({
          message:
            'Your organization data is still resyncing, please try again after it completes',
          success: false,
        });
      } else if (homeOrg?.synced) {
        res.setHeader(headerKeys.HOME_ORGANIZATION_SYNCED, true);
      } else {
        res.setHeader(headerKeys.HOME_ORGANIZATION_SYNCED, false);
      }
      next();
    }
  } else {
    next();
  }
});

app.use(async function (req, res, next) {
  const orgMap = await Organization.getOrgsMap();
  const notSynced = Object.keys(orgMap).find((key) => !orgMap[key].synced);

  res.setHeader(headerKeys.ALL_DATA_SYNCED, !notSynced);

  const syncRemaining = Object.keys(orgMap).reduce((agg, key) => {
    return agg + orgMap[key].sync_remaining;
  }, 0);

  res.setHeader(headerKeys.SYNC_REMAINING, syncRemaining);
  next();
});

app.use(async function (req, res, next) {
  if (CONFIG().CADT.USE_SIMULATOR) {
    res.setHeader(headerKeys.WALLET_SYNCED, true);
  } else {
    res.setHeader(headerKeys.WALLET_SYNCED, await datalayer.walletIsSynced());
  }

  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    message: 'OK',
    timestamp: new Date().toISOString(),
  });
});

app.use('/v1', V1Router);

app.use((err, req, res, next) => {
  if (err) {
    if (_.get(err, 'error.details')) {
      // format Joi validation errors
      return res.status(400).json({
        message: 'Data Validation error',
        success: false,
        errors: err.error.details.map((detail) => {
          return _.get(detail, 'context.message', detail.message);
        }),
      });
    }

    return res.status(err?.status || 400).json(err);
  }

  next();
});

export default app;
