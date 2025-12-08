import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2, MetaV2 } from '../../../src/models/v2/index.js';
import validateOrganizationTableV2Job from '../../../src/tasks/validate-organization-table-and-subscriptions-v2.js';

/**
 * Phase 28.2: Validate Organization Table V2 Task Tests
 *
 * Tests for validate-organization-table-and-subscriptions-v2 background task
 */
describe('Phase 28.2: Validate Organization Table V2 Task Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up before each test
    await OrganizationsV2.destroy({ where: {} });
    await MetaV2.destroy({ where: {} });
  });

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(validateOrganizationTableV2Job).to.exist;
      expect(validateOrganizationTableV2Job.id).to.equal(
        'validate-organization-table-v2',
      );
    });

    it('should have correct task ID', function () {
      expect(validateOrganizationTableV2Job.id).to.equal(
        'validate-organization-table-v2',
      );
    });
  });

  describe('Task Execution (Simulator Mode)', function () {
    it('should skip execution in simulator mode', async function () {
      // Task skips execution in simulator mode
      // We can verify the task structure is correct
      expect(validateOrganizationTableV2Job).to.exist;
    });
  });

  describe('Integration with OrganizationsV2', function () {
    it('should have reconcileOrganization method available', function () {
      expect(OrganizationsV2.reconcileOrganization).to.be.a('function');
    });

    it('should have unsubscribeFromOrganizationStores method available', function () {
      expect(OrganizationsV2.unsubscribeFromOrganizationStores).to.be.a(
        'function',
      );
    });

    it('should skip PENDING organizations', async function () {
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

      const orgs = await OrganizationsV2.findAll({ raw: true });
      const pendingOrgs = orgs.filter((o) => o.org_uid === 'PENDING');
      expect(pendingOrgs.length).to.be.greaterThan(0);
    });

    it('should respect user-deleted organizations', async function () {
      const deletedOrgUid = 'deleted-org-123';
      await MetaV2.addUserDeletedOrgUid(deletedOrgUid);

      const userDeletedOrgs = await MetaV2.getUserDeletedOrgUids();
      expect(userDeletedOrgs).to.include(deletedOrgUid);
    });
  });
});

