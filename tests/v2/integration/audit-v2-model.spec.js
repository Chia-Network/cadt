import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AuditV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';
import TaskManager from '../../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';

/**
 * AuditV2 Model Methods Tests
 *
 * Tests for AuditV2 model methods that exercise model-only logic not
 * reachable through the HTTP layer: resetToGeneration across orgs,
 * resetToDate with home-org exclusion.
 */
describe('AuditV2 Model Methods', function () {
  this.timeout(30000);

  let testOrgUid;

  before(async function () {
    await prepareV2Db();

    TaskManager.stopAll();

    await AuditV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });

    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  after(async function () {
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    TaskManager.start(configV1?.ENABLE !== false, configV2?.ENABLE !== false);
  });

  beforeEach(async function () {
    await AuditV2.destroy({ where: {} });
  });

  describe('resetToGeneration', function () {
    it('should delete records with generation greater than specified', async function () {
      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 2,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash3',
          type: 'delete',
          change: '{"test": "data3"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 2).toString(),
          generation: 3,
        },
      ]);

      const deletedCount = await AuditV2.resetToGeneration(testOrgUid, 1);

      expect(deletedCount).to.equal(2); // Should delete generations 2 and 3

      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(1);
      expect(remaining.rows[0].generation).to.equal(1);
    });

    it('should delete all records when generation is 0', async function () {
      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 2,
        },
      ]);

      const deletedCount = await AuditV2.resetToGeneration(testOrgUid, 0);

      expect(deletedCount).to.equal(2);

      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(0);
    });

    it('should throw error for invalid orgUid', async function () {
      try {
        await AuditV2.resetToGeneration('invalid-org-uid', 1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('is not in the list of subscribed organizations');
      }
    });

    it('should work without orgUid (resets all orgs)', async function () {
      // Create another org
      const otherOrg = await OrganizationsV2.create({
        org_uid: 'other-org-uid-2',
        name: 'Other Org 2',
        registry_id: 'other-registry-2',
        is_home: false,
        subscribed: true,
      });

      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 2,
        },
        {
          org_uid: otherOrg.org_uid,
          registry_id: 'other-registry-2',
          root_hash: 'hash2',
          type: 'insert',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 2,
        },
      ]);

      const deletedCount = await AuditV2.resetToGeneration(null, 1);

      expect(deletedCount).to.equal(2);

      const remaining = await AuditV2.findAuditHistory();
      expect(remaining.count).to.equal(0);
    });
  });

  describe('resetToDate', function () {
    it('should delete records with timestamp greater than specified date', async function () {
      const baseTime = Math.floor(Date.now() / 1000);
      const date1 = new Date((baseTime - 100) * 1000); // 100 seconds ago
      const date2 = new Date((baseTime - 50) * 1000);  // 50 seconds ago
      const date3 = new Date((baseTime + 50) * 1000);  // 50 seconds in future

      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime - 100).toString(),
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime - 50).toString(),
          generation: 2,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash3',
          type: 'delete',
          change: '{"test": "data3"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime + 50).toString(),
          generation: 3,
        },
      ]);

      // Reset to date2 (should delete generation 2 and 3)
      const resetDate = new Date((baseTime - 75) * 1000); // Between date1 and date2
      const deletedCount = await AuditV2.resetToDate(testOrgUid, resetDate);

      expect(deletedCount).to.equal(2); // Should delete generations 2 and 3

      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(1);
      expect(remaining.rows[0].generation).to.equal(1);
    });

    it('should throw error for invalid orgUid', async function () {
      try {
        await AuditV2.resetToDate('invalid-org-uid', new Date());
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('is not in the list of subscribed organizations');
      }
    });

    it('should work without orgUid (resets all orgs except home)', async function () {
      // Create another org
      const otherOrg = await OrganizationsV2.create({
        org_uid: 'other-org-uid-3',
        name: 'Other Org 3',
        registry_id: 'other-registry-3',
        is_home: false,
        subscribed: true,
      });

      const baseTime = Math.floor(Date.now() / 1000);
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime + 100).toString(),
          generation: 1,
        },
        {
          org_uid: otherOrg.org_uid,
          registry_id: 'other-registry-3',
          root_hash: 'hash2',
          type: 'insert',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime + 100).toString(),
          generation: 1,
        },
      ]);

      const resetDate = new Date((baseTime + 50) * 1000);
      const deletedCount = await AuditV2.resetToDate(null, resetDate);

      // Should delete otherOrg's record but not home org's
      expect(deletedCount).to.equal(1);

      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(1);
    });
  });
});

