import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders';

const task = new Task('sync-picklist', () => {
  console.log('Syncing Picklist Values');
  pullPickListValues();
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-picklist',
);

export default job;
