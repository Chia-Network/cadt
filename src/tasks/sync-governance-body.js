import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Governance } from '../models';
import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:governance');

const log = Debug('climate-warehouse:task:governance');

const task = new Task('sync-governance-meta', () => {
  log('Syncing governance data');
  if (
    process.env.GOVERANCE_BODY_ID &&
    process.env.GOVERNANCE_BODY_IP &&
    process.env.GOVERNANCE_BODY_PORT
  ) {
    Governance.sync();
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-governance-meta',
);

export default job;
