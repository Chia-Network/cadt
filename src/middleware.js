'use strict';

import _ from 'lodash';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { V1Router } from './routes/v1';
import { getConfig } from './utils/config-loader';
import { logger } from './config/logger.cjs';
import {
  assertChiaNetworkMatchInConfiguration,
  assertDataLayerAvailable,
  assertWalletIsAvailable,
} from './utils/data-assertions';
import packageJson from '../package.json';

const { API_KEY, READ_ONLY, IS_GOVERNANCE_BODY } = getConfig().APP;

const headerKeys = Object.freeze({
  API_VERSION_HEADER_KEY: 'x-api-version',
  CR_READY_ONLY_HEADER_KEY: 'cw-read-only',
  DATA_MODEL_VERION_HEADER_KEY: 'x-datamodel-version',
  GOVERNANCE_BODY_HEADER_KEY: 'x-governance-body',
});

const app = express();

app.use(
  cors({
    exposedHeaders: Object.values(headerKeys).join(','),
  }),
);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

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
    });
  }
});

// Add optional API key if set in .env file
app.use(function (req, res, next) {
  if (API_KEY && API_KEY !== '') {
    const apikey = req.header('x-api-key');
    if (API_KEY === apikey) {
      next();
    } else {
      res.status(403).json({ message: 'API key not found' });
    }
  } else {
    next();
  }
});

app.use(function (req, res, next) {
  if (READ_ONLY) {
    res.setHeader(headerKeys.CR_READY_ONLY_HEADER_KEY, READ_ONLY);
  } else {
    res.setHeader(headerKeys.CR_READY_ONLY_HEADER_KEY, false);
  }

  next();
});

app.use(function (req, res, next) {
  res.setHeader(headerKeys.GOVERNANCE_BODY_HEADER_KEY, IS_GOVERNANCE_BODY);
  next();
});

app.use(function (req, res, next) {
  logger.debug(
    `Setting header x-api-verion to package.json version: ${packageJson.version}`,
  );
  const version = packageJson.version;
  res.setHeader(headerKeys.API_VERSION_HEADER_KEY, version);

  const majorVersion = version.split('.')[0];
  res.setHeader(headerKeys.DATA_MODEL_VERION_HEADER_KEY, `v${majorVersion}`);

  next();
});

app.use('/v1', V1Router);

app.use((err, req, res, next) => {
  if (err) {
    if (_.get(err, 'error.details')) {
      // format Joi validation errors
      return res.status(400).json({
        message: 'Data Validation error',
        errors: err.error.details.map((detail) => {
          return _.get(detail, 'context.message', detail.message);
        }),
      });
    }

    return res.status(err.status).json(err);
  }

  next();
});

export default app;
