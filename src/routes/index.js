'use strict';

import { prepareDb } from '../database';
import scheduler from '../tasks';
import { sequelize } from '../database';
import { logger } from '../logger.js';
import { pullPickListValues } from '../utils/data-loaders';

import app from '../middleware';

sequelize.authenticate().then(async () => {
  logger.info('Connected to database');
  await prepareDb();
  pullPickListValues();

  setTimeout(() => {
    scheduler.start();
  }, 5000);
});

export default app;
