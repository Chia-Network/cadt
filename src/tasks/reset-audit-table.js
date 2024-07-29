import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Audit, Meta } from '../models/index.js';
import { logger } from '../config/logger.cjs';
import dotenv from 'dotenv';
import _ from 'lodash';
dotenv.config();

const task = new Task('reset-audit-table', async () => {
  try {
    const metaResult = await Meta.findOne({
      where: {
        metaKey: 'may2024AuditResetTaskHasRun',
      },
      attributes: ['metaValue'],
      raw: true,
    });

    const taskHasRun = metaResult?.metaValue;

    if (taskHasRun === 'true') {
      return;
    }

    logger.info('performing audit table reset');

    const where = { type: 'NO CHANGE' };
    const noChangeEntries = await Audit.findAll({ where });

    if (noChangeEntries.length) {
      const result = await Audit.resetToDate('2024-05-11');
      logger.info(
        'audit table has been reset, records modified: ' + String(result),
      );
    }

    if (_.isNil(taskHasRun)) {
      await Meta.create({
        metaKey: 'may2024AuditResetTaskHasRun',
        metaValue: 'true',
      });
    } else {
      await Meta.update(
        { metavalue: 'true' },
        {
          where: {
            metakey: 'may2024AuditResetTaskHasRun',
          },
          returning: true,
        },
      );
    }
  } catch (error) {
    logger.error('Retrying in 600 seconds', error);
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: 600,
    runImmediately: true,
  },
  task,
  { id: 'reset-audit-table', preventOverrun: true },
);

export default job;
