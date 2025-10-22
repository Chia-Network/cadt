'use strict';

import { prepareDb } from '../database';
import { prepareV2Db } from '../database/v2/index.js';
import scheduler from '../tasks';
import { sequelize } from '../database';
import { logger } from '../config/logger.js';
import { pullPickListValues } from '../utils/data-loaders';

import app from '../middleware';

sequelize.authenticate().then(async () => {
  logger.info('Connected to database');
  pullPickListValues();
  await prepareDb();
  await prepareV2Db();
  setTimeout(() => {
    scheduler.start();
  }, 5000);
});

export default app;
