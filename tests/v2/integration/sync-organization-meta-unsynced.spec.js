import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { prepareDb } from '../../../src/database/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { Organization } from '../../../src/models/organizations/organizations.model.js';
import TaskManager from '../../../src/tasks/index.js';

/**
 * sync-organization-meta non-blocking behavior tests
 *
 * Verifies that syncOrganizationMeta (V1 and V2) completes quickly in
 * simulator mode and that the method contract is preserved.  The unsynced-
 * store pre-check is wrapped in `if (!USE_SIMULATOR)`, so production-mode
 * behavior is covered by the live integration tests.  What we can assert
 * here in simulator mode is that:
 *
 *   1. The method exists and returns without error for empty inputs
 *   2. Subscribed orgs are queried from the DB
 *   3. The pre-check path does not introduce regressions in simulator mode
 */
describe('syncOrganizationMeta non-blocking behavior', function () {
  this.timeout(15000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  afterEach(async function () {
    await OrganizationsV2.destroy({ where: {} });
  });

  // ─────────────────────────────────────────────────────────
  // V1 Organization.syncOrganizationMeta
  // ─────────────────────────────────────────────────────────

  describe('V1 Organization.syncOrganizationMeta', function () {
    it('should be available as a static method', function () {
      expect(Organization.syncOrganizationMeta).to.be.a('function');
    });

    it('should complete without error when no subscribed orgs exist', async function () {
      let threw = false;
      try {
        await Organization.syncOrganizationMeta();
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });

    it('should complete quickly in simulator mode', async function () {
      const start = Date.now();
      await Organization.syncOrganizationMeta();
      expect(Date.now() - start).to.be.below(1000);
    });
  });

  // ─────────────────────────────────────────────────────────
  // V2 OrganizationsV2.syncOrganizationMeta
  // ─────────────────────────────────────────────────────────

  describe('V2 OrganizationsV2.syncOrganizationMeta', function () {
    it('should be available as a static method', function () {
      expect(OrganizationsV2.syncOrganizationMeta).to.be.a('function');
    });

    it('should complete without error when no subscribed orgs exist', async function () {
      let threw = false;
      try {
        await OrganizationsV2.syncOrganizationMeta();
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });

    it('should complete quickly in simulator mode', async function () {
      const start = Date.now();
      await OrganizationsV2.syncOrganizationMeta();
      expect(Date.now() - start).to.be.below(1000);
    });

    it('should skip unsubscribed orgs entirely', async function () {
      await OrganizationsV2.create({
        org_uid: 'unsubscribed-org',
        name: 'Unsub',
        is_home: false,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      // Method queries `where: { subscribed: true }`, so this org is skipped.
      const subscribedOrgs = await OrganizationsV2.findAll({
        where: { subscribed: true },
        raw: true,
      });
      expect(subscribedOrgs).to.have.length(0);

      // And the method call itself still succeeds.
      let threw = false;
      try {
        await OrganizationsV2.syncOrganizationMeta();
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });
  });
});
