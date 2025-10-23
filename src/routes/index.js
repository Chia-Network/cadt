'use strict';

import { prepareDb } from '../database';
import { prepareV2Db } from '../database/v2';
import scheduler from '../tasks';
import { sequelize } from '../database';
import { sequelizeV2 } from '../database/v2';
import { logger } from '../config/logger.js';
import { pullPickListValues } from '../utils/data-loaders';
import { pullPickListValuesV2 } from '../utils/v2-data-loaders';

import app from '../middleware';

sequelize.authenticate().then(async () => {
  logger.info('Connected to database');
  pullPickListValues();
  await prepareDb();
  setTimeout(() => {
    scheduler.start();
  }, 5000);
});

// Initialize V2 database
sequelizeV2.authenticate().then(async () => {
  logger.info('Connected to V2 database');
  pullPickListValuesV2();
  await prepareV2Db();
});

export default app;
