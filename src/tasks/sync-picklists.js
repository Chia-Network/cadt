import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders';
import Debug from 'debug';
Debug.enable('climate-warehouse:task:picklists');

const log = Debug('climate-warehouse:task:picklists');

const task = new Task('sync-picklist', () => {
  log('Syncing Picklist Values');
  pullPickListValues();
});

const job = new SimpleIntervalJob(
  { seconds: 30, runImmediately: true },
  task,
  'sync-picklist',
);

export default job;
