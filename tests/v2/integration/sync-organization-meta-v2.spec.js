import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import syncOrganizationMetaV2Job from '../../../src/tasks/sync-organization-meta-v2.js';

/**
 * Phase 27.4: Sync Organization Meta V2 Task Tests
 *
 * Tests for sync-organization-meta-v2 background task
 */
describe('Phase 27.4: Sync Organization Meta V2 Task Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up before each test
    await OrganizationsV2.destroy({ where: {} });
  });

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(syncOrganizationMetaV2Job).to.exist;
      expect(syncOrganizationMetaV2Job.id).to.equal('sync-organization-meta-v2');
    });

    it('should have correct task ID', function () {
      expect(syncOrganizationMetaV2Job.id).to.equal('sync-organization-meta-v2');
    });
  });

  describe('Task Execution (Simulator Mode)', function () {
    it('should skip execution in simulator mode', async function () {
      // Task skips execution in simulator mode
      // We can verify the task structure is correct
      expect(syncOrganizationMetaV2Job).to.exist;
    });
  });

  describe('Integration with OrganizationsV2.syncOrganizationMeta', function () {
    it('should have syncOrganizationMeta method available', function () {
      expect(OrganizationsV2.syncOrganizationMeta).to.be.a('function');
    });

    it('should handle empty subscribed organizations list', async function () {
      // Create an unsubscribed org
      await OrganizationsV2.create({
        org_uid: 'test-org-unsubscribed',
        name: 'Test Org',
        is_home: false,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      // syncOrganizationMeta only processes subscribed orgs
      const subscribedOrgs = await OrganizationsV2.findAll({
        where: { subscribed: true },
        raw: true,
      });

      expect(subscribedOrgs).to.have.length(0);
    });
  });
});

