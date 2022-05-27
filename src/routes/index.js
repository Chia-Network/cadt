'use strict';

import { prepareDb } from '../database';
import scheduler from '../tasks';
import { sequelize } from '../database';
import { logger } from '../config/logger.cjs';
import { pullPickListValues } from '../utils/data-loaders';

import app from '../middleware';

sequelize.authenticate().then(async () => {
  logger.info('Connected to database');
  pullPickListValues();
  await prepareDb();
  setTimeout(() => {
    scheduler.start();
  }, 5000);
});

export default app;
