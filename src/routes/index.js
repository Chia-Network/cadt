'use strict';

import { prepareDb } from '../database/index.js';
import scheduler from '../tasks/index.js';
import { sequelize } from '../database/index.js';
import { logger } from '../config/logger.cjs';
import { pullPickListValues } from '../utils/data-loaders.js';

import app from '../middleware.js';

sequelize.authenticate().then(async () => {
  logger.info('Connected to database');
  pullPickListValues();
  await prepareDb();
  setTimeout(() => {
    scheduler.start();
  }, 5000);
});

export default app;
