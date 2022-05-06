'use strict';

import _ from 'lodash';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { prepareDb } from '../database';
import scheduler from '../tasks';
import { V1Router } from './v1';
import { sequelize } from '../database';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';
import {
  assertChiaNetworkMatchInConfiguration,
  assertDataLayerAvailable,
  assertWalletIsAvailable,
} from '../utils/data-assertions';

const { API_KEY, READ_ONLY } = getConfig().APP;
const app = express();

app.use(cors());
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
    res.status(400).json({ message: err.message });
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

// Add readonly header if set in .env file
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Expose-Headers', 'cw-read-only');
  if (READ_ONLY) {
    res.setHeader('cw-read-only', READ_ONLY);
  } else {
    res.setHeader('cw-read-only', false);
  }

  next();
});

app.use('/v1', V1Router);

sequelize.authenticate().then(async () => {
  logger.info('Connected to database');
  await prepareDb();
  setTimeout(() => {
    scheduler.start();
  }, 5000);
});

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
