import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { Organization } from '../../../src/models/organizations/organizations.model.js';
import { prepareDb } from '../../../src/database/index.js';
import TaskManager from '../../../src/tasks/index.js';

/**
 * Reconcile Unsynced Stores Tests
 *
 * Verifies that the reconcile methods have the right shape and
 * complete quickly in the test environment (simulator mode).
 *
 * The sync pre-check guards (subscribe → getDataLayerStoreSyncStatus →
 * skip if unsynced) are wrapped in `if (!USE_SIMULATOR)` so they only
 * run in production.  The production-mode paths are exercised by the
 * live integration tests; these unit tests cover the simulator fast-path
 * and method-contract assertions.
 */
describe('Reconcile Unsynced Stores', function () {
  this.timeout(10000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  afterEach(async function () {
    await OrganizationsV2.destroy({ where: {} });
  });

  // ─────────────────────────────────────────────────────────
  // V1 reconcileOrganization
  // ─────────────────────────────────────────────────────────

  describe('V1 Organization.reconcileOrganization', function () {
    it('should be available as a static method', function () {
      expect(Organization.reconcileOrganization).to.be.a('function');
    });

    it('should return immediately in simulator mode without error', async function () {
      const org = {
        orgUid: 'test-org-v1',
        name: 'Test Org',
        registryId: 'reg-v1',
        dataModelVersionStoreId: 'singleton-v1',
        isHome: false,
      };
      const start = Date.now();
      await Organization.reconcileOrganization(org);
      expect(Date.now() - start).to.be.below(500, 'should complete quickly in simulator mode');
    });

    it('should skip PENDING organization and return without error', async function () {
      const pendingOrg = {
        orgUid: 'PENDING',
        name: '',
        registryId: null,
        dataModelVersionStoreId: null,
        isHome: true,
      };
      let threw = false;
      try {
        await Organization.reconcileOrganization(pendingOrg);
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });

    it('should complete without error for a typical org in simulator mode', async function () {
      // In simulator mode the function short-circuits immediately.
      // In production the sync pre-checks run before subscribeToOrganization.
      const org = {
        orgUid: 'some-org-uid',
        name: 'Some Org',
        registryId: 'some-registry-id',
        dataModelVersionStoreId: 'some-singleton-id',
        isHome: false,
      };
      let threw = false;
      try {
        await Organization.reconcileOrganization(org);
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────
  // V2 reconcileOrganization
  // ─────────────────────────────────────────────────────────

  describe('V2 OrganizationsV2.reconcileOrganization', function () {
    it('should be available as a static method', function () {
      expect(OrganizationsV2.reconcileOrganization).to.be.a('function');
    });

    it('should complete within 2 seconds in simulator mode for an unknown org', async function () {
      // In simulator mode the pre-check block (!USE_SIMULATOR guard) is skipped.
      // subscribeToOrganization runs in simulator mode; for an unknown org it throws
      // quickly.  Verify there is NO 10-minute blocking wait anywhere in the path.
      const org = {
        org_uid: 'reconcile-test-org-v2',
        is_home: false,
        data_model_version_store_id: 'singleton-v2',
      };
      const start = Date.now();
      try {
        await OrganizationsV2.reconcileOrganization(org);
      } catch {
        // Expected - no simulator store data for this org
      }
      expect(Date.now() - start).to.be.below(2000, 'should not block for 10 minutes');
    });

    it('should have subscribeToOrganization as a static method', function () {
      expect(OrganizationsV2.subscribeToOrganization).to.be.a('function');
    });

    it('should have getRegistryStoreIdFromSingleton as a static method', function () {
      expect(OrganizationsV2.getRegistryStoreIdFromSingleton).to.be.a('function');
    });

    it('getRegistryStoreIdFromSingleton should fail quickly in simulator mode for unknown store', async function () {
      // In simulator mode, getRegistryStoreIdFromSingleton uses getStoreDataPromise
      // directly (no blocking wait loop).  An unknown store should fail fast.
      const start = Date.now();
      let error = null;
      try {
        await OrganizationsV2.getRegistryStoreIdFromSingleton('unknown-singleton', 'v2');
      } catch (e) {
        error = e;
      }
      expect(Date.now() - start).to.be.below(1000, 'simulator mode should fail fast for unknown store');
      expect(error).to.exist;
    });
  });
});
