import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { prepareDb } from '../../../src/database/index.js';
import { GovernanceV2 } from '../../../src/models/v2/index.js';
import TaskManager from '../../../src/tasks/index.js';

/**
 * Governance Sync Task Schedule & Failure Behavior Tests
 *
 * These tests verify:
 *   1. The default governance sync interval is 30 seconds
 *   2. The task jobs are importable
 *   3. upsertGovernanceDownload is idempotent — repeated calls update existing
 *      records and preserve unrelated cached data (the semantics that let us
 *      safely drop the in-task retry loop and rely on scheduler cadence).
 *
 * Note: There is NO in-task retry loop any more.  On failure the sync logs
 * and returns, and the scheduler re-runs the task on its normal cadence.
 */
describe('Governance Sync Task Schedule', function () {
  this.timeout(15000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  afterEach(async function () {
    await GovernanceV2.destroy({ where: {} });
  });

  // ─────────────────────────────────────────────────────────
  // Governance interval configuration
  // ─────────────────────────────────────────────────────────

  describe('Default governance sync interval', function () {
    it('defaultConfig should specify 30 seconds for GOVERNANCE_SYNC_TASK_INTERVAL', async function () {
      const { defaultConfig } = await import('../../../src/utils/defaultConfig.js');
      expect(defaultConfig.APP.TASKS.GOVERNANCE_SYNC_TASK_INTERVAL).to.equal(30);
    });

    it('V1 governance task job should be importable and have the correct id', async function () {
      const govJob = (await import('../../../src/tasks/sync-governance-body.js')).default;
      expect(govJob).to.exist;
      expect(govJob.id).to.equal('sync-governance-meta');
    });

    it('V2 governance task job should be importable and have the correct id', async function () {
      const govV2Job = (await import('../../../src/tasks/sync-governance-body-v2.js')).default;
      expect(govV2Job).to.exist;
      expect(govV2Job.id).to.equal('sync-governance-meta-v2');
    });
  });

  // ─────────────────────────────────────────────────────────
  // upsertGovernanceDownload idempotency (verifies cache semantics)
  // ─────────────────────────────────────────────────────────

  describe('V2 GovernanceV2.upsertGovernanceDownload idempotency', function () {
    it('should overwrite orgList on a second call with different data', async function () {
      const bodyId = 'test-gov-body';

      await GovernanceV2.upsertGovernanceDownload(bodyId, {
        orgList: JSON.stringify({ orgs: ['org-v1'] }),
        pickList: '{}',
        glossary: '{}',
      });

      const v1Record = await GovernanceV2.findOne({ where: { meta_key: 'orgList' } });
      expect(JSON.parse(v1Record.meta_value)).to.deep.equal({ orgs: ['org-v1'] });

      await GovernanceV2.upsertGovernanceDownload(bodyId, {
        orgList: JSON.stringify({ orgs: ['org-v2'] }),
        pickList: '{}',
        glossary: '{}',
      });

      const v2Record = await GovernanceV2.findOne({ where: { meta_key: 'orgList' } });
      expect(JSON.parse(v2Record.meta_value)).to.deep.equal({ orgs: ['org-v2'] });
    });

    it('should not delete unrelated governance keys on partial update', async function () {
      const bodyId = 'test-gov-body';

      // First call: write all three keys
      await GovernanceV2.upsertGovernanceDownload(bodyId, {
        orgList: JSON.stringify({ orgs: ['org-a'] }),
        pickList: JSON.stringify({ items: ['item-1'] }),
        glossary: JSON.stringify({ terms: ['term-1'] }),
      });

      // Second call: only write orgList (pickList and glossary absent)
      await GovernanceV2.upsertGovernanceDownload(bodyId, {
        orgList: JSON.stringify({ orgs: ['org-b'] }),
      });

      // The previous pickList and glossary should still exist (not deleted)
      const pickList = await GovernanceV2.findOne({ where: { meta_key: 'pickList' } });
      expect(pickList).to.exist;

      const glossary = await GovernanceV2.findOne({ where: { meta_key: 'glossary' } });
      expect(glossary).to.exist;

      // orgList should be updated
      const orgList = await GovernanceV2.findOne({ where: { meta_key: 'orgList' } });
      expect(JSON.parse(orgList.meta_value)).to.deep.equal({ orgs: ['org-b'] });
    });
  });
});
