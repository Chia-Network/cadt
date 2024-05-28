import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Audit, Meta } from '../models';
import { logger } from '../config/logger.cjs';
import { getConfig } from '../utils/config-loader';
const CONFIG = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

const task = new Task('reset-audit-table', async () => {
  try {
    const taskHasRun = await Meta.findOne({
      where: {
        metaKey: 'may2024AuditResetTaskHasRun',
      },
      attributes: ['metaValue'],
    });

    console.log(taskHasRun);

    if (taskHasRun === 'true') {
      return;
    }

    logger.info('performing audit table reset');

    const where = { type: 'NO CHANGE' };
    const noChangeEntries = Audit.findAll({ where });

    if (noChangeEntries) {
      return;
    }

    await Audit.resetToTimestamp('1715385600000'); // ms timestamp for 5/11/2024
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 30
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.RESET_AUDIT_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  { id: 'reset-audit-table', preventOverrun: true },
);

export default job;
