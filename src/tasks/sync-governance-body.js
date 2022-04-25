import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Governance } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';
const { GOVERANCE_BODY_ID, GOVERNANCE_BODY_IP, GOVERNANCE_BODY_PORT } =
  getConfig().GOVERNANCE;

import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:governance');

const log = Debug('climate-warehouse:task:governance');

const task = new Task('sync-governance-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    log('Syncing governance data');
    if (
      process.env.GOVERANCE_BODY_ID &&
      process.env.GOVERNANCE_BODY_IP &&
      process.env.GOVERNANCE_BODY_PORT
    ) {
      Governance.sync();
    }
  } catch (error) {
    log(`${error.message} retrying in 24 hours`);
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-governance-meta',
);

export default job;
