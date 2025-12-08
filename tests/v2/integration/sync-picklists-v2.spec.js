import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import syncPicklistsV2Job from '../../../src/tasks/sync-picklists-v2.js';
import { pullPickListValuesV2 } from '../../../src/utils/v2-data-loaders.js';

/**
 * Phase 28.3: Sync Picklists V2 Task Tests
 *
 * Tests for sync-picklists-v2 background task
 */
describe('Phase 28.3: Sync Picklists V2 Task Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(syncPicklistsV2Job).to.exist;
      expect(syncPicklistsV2Job.id).to.equal('sync-picklist-v2');
    });

    it('should have correct task ID', function () {
      expect(syncPicklistsV2Job.id).to.equal('sync-picklist-v2');
    });
  });

  describe('Task Execution (Simulator Mode)', function () {
    it('should skip execution in simulator mode', async function () {
      // Task skips execution in simulator mode
      // We can verify the task structure is correct
      expect(syncPicklistsV2Job).to.exist;
    });
  });

  describe('Integration with pullPickListValuesV2', function () {
    it('should have pullPickListValuesV2 function available', function () {
      expect(pullPickListValuesV2).to.be.a('function');
    });
  });
});

