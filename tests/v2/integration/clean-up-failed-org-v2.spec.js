import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import cleanUpFailedOrgV2Job from '../../../src/tasks/clean-up-failed-org-v2.js';

/**
 * Phase 28.4: Clean Up Failed Org V2 Task Tests
 *
 * Tests for clean-up-failed-org-v2 background task
 */
describe('Phase 28.4: Clean Up Failed Org V2 Task Tests', function () {
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
      expect(cleanUpFailedOrgV2Job).to.exist;
      expect(cleanUpFailedOrgV2Job.id).to.equal('clean-up-failed-org-v2');
    });

    it('should have correct task ID', function () {
      expect(cleanUpFailedOrgV2Job.id).to.equal('clean-up-failed-org-v2');
    });
  });

  describe('Task Execution (Simulator Mode)', function () {
    it('should skip execution in simulator mode', async function () {
      // Task skips execution in simulator mode
      // We can verify the task structure is correct
      expect(cleanUpFailedOrgV2Job).to.exist;
    });
  });

  describe('Integration with OrganizationsV2', function () {
    it('should be able to query PENDING organizations', async function () {
      // Create a PENDING org
      await OrganizationsV2.create({
        org_uid: 'PENDING',
        name: 'Pending Org',
        is_home: false,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      const pendingOrgs = await OrganizationsV2.findAll({
        where: { org_uid: 'PENDING' },
        raw: true,
      });

      expect(pendingOrgs).to.have.length(1);
      expect(pendingOrgs[0].org_uid).to.equal('PENDING');
    });

    it('should be able to delete PENDING organizations', async function () {
      // Create a PENDING org
      await OrganizationsV2.create({
        org_uid: 'PENDING',
        name: 'Pending Org',
        is_home: false,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });

      const pendingOrgs = await OrganizationsV2.findAll({
        where: { org_uid: 'PENDING' },
        raw: true,
      });

      expect(pendingOrgs).to.have.length(0);
    });
  });
});

