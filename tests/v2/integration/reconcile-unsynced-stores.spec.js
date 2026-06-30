import { expect } from 'chai';
import sinon from 'sinon';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { Organization } from '../../../src/models/organizations/organizations.model.js';
import { prepareDb } from '../../../src/database/index.js';
import TaskManager from '../../../src/tasks/index.js';
import { withConfigOverride } from '../utils/v2-test-helpers.js';

/**
 * Reconcile Unsynced Stores Tests
 *
 * Verifies that the reconcile methods have the right shape and
 * complete quickly in the test environment (simulator mode).
 *
 * The sync pre-check guards (subscribe → getDataLayerStoreSyncStatus →
 * skip if unsynced) only run outside simulator mode. V1 returns early
 * at the start of reconcileOrganization; V2 wraps the pre-check block in
 * `if (!USE_SIMULATOR)`.
 *
 * The `{ skipOnUnsynced }` option controls whether the pre-check path
 * silently returns (background tasks: true) or throws (request-path
 * callers like resyncOrganization controller: false, the default).
 * Throwing on the default matters because request-path callers run
 * destructive writes (reset registry_hash, delete audit records) after
 * reconcile and must not proceed on stale state.  Option semantics are
 * verified here by signature checks and focused production-mode stubs.
 */
describe('Reconcile Unsynced Stores', function () {
  this.timeout(30000);

  let originalUseSimulator;
  let originalUseDevMode;

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  beforeEach(function () {
    originalUseSimulator = process.env.USE_SIMULATOR;
    originalUseDevMode = process.env.USE_DEVELOPMENT_MODE;
  });

  afterEach(async function () {
    sinon.restore();
    if (originalUseSimulator !== undefined) {
      process.env.USE_SIMULATOR = originalUseSimulator;
    } else {
      delete process.env.USE_SIMULATOR;
    }
    if (originalUseDevMode !== undefined) {
      process.env.USE_DEVELOPMENT_MODE = originalUseDevMode;
    } else {
      delete process.env.USE_DEVELOPMENT_MODE;
    }
    await OrganizationsV2.destroy({ where: {} });
  });

  const withProductionConfig = async (testFn) => {
    delete process.env.USE_SIMULATOR;
    delete process.env.USE_DEVELOPMENT_MODE;

    // Reconcile reads USE_SIMULATOR at call time; tests still stub downstream
    // subscription helpers whose modules keep the import-time simulator mode.
    return await withConfigOverride(testFn, {
      APP: { USE_SIMULATOR: false, USE_DEVELOPMENT_MODE: false },
    });
  };

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

    it('returns cleanly when the singleton subscribe returns falsy and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-subscribe-org-v1';
      const singletonStoreId = 'reconcile-subscribe-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).resolves(false);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        await Organization.reconcileOrganization(
          {
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          },
          { skipOnUnsynced: true },
        );

        const orgSubscribe = subscribeStub
          .getCalls()
          .find((call) => call.args[0] === orgUid);
        const singletonSubscribe = subscribeStub
          .getCalls()
          .find((call) => call.args[0] === singletonStoreId);

        expect(orgSubscribe, 'org-store subscribe must run').to.exist;
        expect(singletonSubscribe, 'singleton-store subscribe must run').to.exist;
        expect(orgSubscribe.calledBefore(singletonSubscribe)).to.equal(
          true,
          'singleton subscribe must run after the org pre-check',
        );
        const singletonStatusCalled = syncStatusStub
          .getCalls()
          .some((call) => call.args[0] === singletonStoreId);
        expect(singletonStatusCalled).to.equal(
          false,
          'singleton status check must be skipped when singleton subscribe fails',
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe fails',
        );
      });
    });

    it('returns cleanly when the singleton subscribe throws and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-subscribe-throw-org-v1';
      const singletonStoreId = 'reconcile-subscribe-throw-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).rejects(new Error('datalayer unavailable'));

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        await Organization.reconcileOrganization(
          {
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          },
          { skipOnUnsynced: true },
        );

        const singletonStatusCalled = syncStatusStub
          .getCalls()
          .some((call) => call.args[0] === singletonStoreId);
        expect(singletonStatusCalled).to.equal(
          false,
          'singleton status check must be skipped when singleton subscribe throws',
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe throws',
        );
      });
    });

    it('throws when the singleton subscribe returns falsy and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-throw-org-v1';
      const singletonStoreId = 'reconcile-throw-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).resolves(false);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await Organization.reconcileOrganization({
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not subscribe to singleton store ${singletonStoreId} for org ${orgUid}`,
        );
        const singletonStatusCalled = syncStatusStub
          .getCalls()
          .some((call) => call.args[0] === singletonStoreId);
        expect(singletonStatusCalled).to.equal(
          false,
          'singleton status check must be skipped when singleton subscribe fails',
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe fails',
        );
      });
    });

    it('throws when the singleton subscribe throws and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-throw-error-org-v1';
      const singletonStoreId = 'reconcile-throw-error-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).rejects(new Error('datalayer unavailable'));

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await Organization.reconcileOrganization({
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not subscribe to singleton store ${singletonStoreId} for org ${orgUid}: datalayer unavailable`,
        );
        const singletonStatusCalled = syncStatusStub
          .getCalls()
          .some((call) => call.args[0] === singletonStoreId);
        expect(singletonStatusCalled).to.equal(
          false,
          'singleton status check must be skipped when singleton subscribe throws',
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe throws',
        );
      });
    });

    it('returns cleanly when org store data is unavailable and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-org-data-missing-v1';
      const singletonStoreId = 'org-data-missing-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves(null);
        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        await Organization.reconcileOrganization(
          {
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          },
          { skipOnUnsynced: true },
        );

        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('throws when org store data fetch fails and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-org-data-error-v1';
      const singletonStoreId = 'org-data-error-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .rejects(new Error('datalayer unavailable'));
        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await Organization.reconcileOrganization({
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not get current data for org store ${orgUid}: datalayer unavailable`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('returns cleanly when no singleton id can be determined and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-missing-singleton-skip-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ name: 'org data without registryId' });
        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        await Organization.reconcileOrganization(
          {
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: null,
            isHome: false,
          },
          { skipOnUnsynced: true },
        );

        expect(subscribeStub.calledOnceWithExactly(orgUid)).to.equal(true);
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('throws when no singleton id can be determined and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-missing-singleton-throw-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ name: 'org data without registryId' });
        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await Organization.reconcileOrganization({
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: null,
            isHome: false,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not determine singleton store for org ${orgUid}`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('returns cleanly when the singleton store is unsynced and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-unsynced-skip-org-v1';
      const singletonStoreId = 'reconcile-unsynced-skip-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon.stub(datalayerModule.default, 'subscribeToStoreOnDataLayer').resolves(true);
        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 0, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });
        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        await Organization.reconcileOrganization(
          {
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          },
          { skipOnUnsynced: true },
        );

        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('throws when the singleton store is unsynced and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-unsynced-throw-org-v1';
      const singletonStoreId = 'reconcile-unsynced-throw-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon.stub(datalayerModule.default, 'subscribeToStoreOnDataLayer').resolves(true);
        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 0, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });
        const subscribeToOrganizationStub = sinon.stub(
          Organization,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await Organization.reconcileOrganization({
            orgUid,
            name: 'V1 Org',
            registryId: 'registry-v1',
            dataModelVersionStoreId: singletonStoreId,
            isHome: false,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `singleton store ${singletonStoreId} for org ${orgUid} not yet synced`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('falls back to the database singleton id when org store data has no registryId', async function () {
      const orgUid = 'reconcile-fallback-org-v1';
      const singletonStoreId = 'fallback-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ name: 'org data without registryId' });

        const subscribeToOrganizationStub = sinon
          .stub(Organization, 'subscribeToOrganization')
          .rejects(new Error('stop after fallback pre-checks'));

        let error = null;
        try {
          await Organization.reconcileOrganization(
            {
              orgUid,
              name: 'V1 Org',
              registryId: 'registry-v1',
              dataModelVersionStoreId: singletonStoreId,
              isHome: false,
            },
            { skipOnUnsynced: true },
          );
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(subscribeToOrganizationStub.calledOnceWithExactly(orgUid)).to.equal(true);
        expect(subscribeStub.calledWith(singletonStoreId)).to.equal(
          true,
          'singleton pre-check must fall back to the database singleton id',
        );
        expect(syncStatusStub.calledWith(singletonStoreId)).to.equal(true);
      });
    });

    it('reaches subscribeToOrganization after org-derived singleton pre-checks pass', async function () {
      const orgUid = 'reconcile-happy-org-v1';
      const staleSingletonStoreId = 'stale-singleton-v1';
      const singletonStoreId = 'org-derived-singleton-v1';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon
          .stub(Organization, 'subscribeToOrganization')
          .rejects(new Error('stop after pre-checks'));

        let error = null;
        try {
          await Organization.reconcileOrganization(
            {
              orgUid,
              name: 'V1 Org',
              registryId: 'registry-v1',
              dataModelVersionStoreId: staleSingletonStoreId,
              isHome: false,
            },
            { skipOnUnsynced: true },
          );
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(subscribeToOrganizationStub.calledOnceWithExactly(orgUid)).to.equal(true);
        expect(subscribeStub.calledWith(singletonStoreId)).to.equal(
          true,
          'singleton pre-check must use the org-store-derived singleton id',
        );
        expect(subscribeStub.calledWith(staleSingletonStoreId)).to.equal(false);
      });
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

    it('subscribes to the singleton store before checking singleton sync status', async function () {
      const orgUid = 'reconcile-subscribe-org-v2';
      const singletonStoreId = 'reconcile-subscribe-singleton-v2';

      await withProductionConfig(
        async () => {
          const datalayerModule = await import('../../../src/datalayer/index.js');
          let singletonSubscribeResolved = false;
          let singletonStatusSawResolvedSubscribe = false;
          const subscribeStub = sinon
            .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
            .callsFake(async (storeId) => {
              if (storeId === singletonStoreId) {
                await Promise.resolve();
                singletonSubscribeResolved = true;
              }
              return true;
            });
          const syncStatusStub = sinon
            .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
            .callsFake(async (storeId) => {
              if (storeId === singletonStoreId) {
                singletonStatusSawResolvedSubscribe = singletonSubscribeResolved;
                return { sync_status: { generation: 0, target_generation: 1 } };
              }
              return { sync_status: { generation: 1, target_generation: 1 } };
            });
          sinon
            .stub(datalayerModule.default, 'getCurrentStoreData')
            .withArgs(orgUid)
            .resolves({ registryId: singletonStoreId });

          const subscribeToOrganizationStub = sinon.stub(
            OrganizationsV2,
            'subscribeToOrganization',
          );

          await OrganizationsV2.reconcileOrganization(
            {
              org_uid: orgUid,
              is_home: false,
              data_model_version_store_id: singletonStoreId,
            },
            { skipOnUnsynced: true },
          );

          const orgSubscribe = subscribeStub
            .getCalls()
            .find((call) => call.args[0] === orgUid);
          const singletonSubscribe = subscribeStub
            .getCalls()
            .find((call) => call.args[0] === singletonStoreId);
          const orgStatus = syncStatusStub
            .getCalls()
            .find((call) => call.args[0] === orgUid);
          const singletonStatus = syncStatusStub
            .getCalls()
            .find((call) => call.args[0] === singletonStoreId);

          expect(orgSubscribe, 'org-store subscribe must run').to.exist;
          expect(orgStatus, 'org-store status check must run').to.exist;
          expect(singletonSubscribe, 'singleton-store subscribe must run').to.exist;
          expect(singletonStatus, 'singleton-store status check must run').to.exist;
          expect(orgSubscribe.calledBefore(orgStatus)).to.equal(
            true,
            'org subscribe must run before org status check',
          );
          expect(orgStatus.calledBefore(singletonSubscribe)).to.equal(
            true,
            'singleton subscribe must run after the org is synced',
          );
          expect(singletonSubscribe.calledBefore(singletonStatus)).to.equal(
            true,
            'singleton subscribe must run before singleton status check',
          );
          expect(singletonStatusSawResolvedSubscribe).to.equal(
            true,
            'singleton subscribe must resolve before singleton status check',
          );
          expect(subscribeToOrganizationStub.called).to.equal(
            false,
            'subscribeToOrganization must not run while singleton store is unsynced',
          );
        },
      );
    });

    it('returns cleanly when the singleton subscribe returns falsy and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-subscribe-false-org-v2';
      const singletonStoreId = 'reconcile-subscribe-false-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).resolves(false);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        await OrganizationsV2.reconcileOrganization(
          {
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          },
          { skipOnUnsynced: true },
        );

        const singletonStatusCalled = syncStatusStub
          .getCalls()
          .some((call) => call.args[0] === singletonStoreId);
        expect(singletonStatusCalled).to.equal(
          false,
          'singleton status check must be skipped when singleton subscribe fails',
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe fails',
        );
      });
    });

    it('throws when the singleton subscribe returns falsy and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-subscribe-false-throw-org-v2';
      const singletonStoreId = 'reconcile-subscribe-false-throw-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).resolves(false);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization({
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not subscribe to singleton store ${singletonStoreId} for org ${orgUid}`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe fails',
        );
      });
    });

    it('returns cleanly when the singleton subscribe throws and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-subscribe-throw-org-v2';
      const singletonStoreId = 'reconcile-subscribe-throw-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).rejects(new Error('datalayer unavailable'));

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        await OrganizationsV2.reconcileOrganization(
          {
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          },
          { skipOnUnsynced: true },
        );

        const singletonStatusCalled = syncStatusStub
          .getCalls()
          .some((call) => call.args[0] === singletonStoreId);
        expect(singletonStatusCalled).to.equal(
          false,
          'singleton status check must be skipped when singleton subscribe throws',
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe throws',
        );
      });
    });

    it('throws when the singleton subscribe throws and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-subscribe-error-throw-org-v2';
      const singletonStoreId = 'reconcile-subscribe-error-throw-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(orgUid).resolves(true);
        subscribeStub.withArgs(singletonStoreId).rejects(new Error('datalayer unavailable'));

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization({
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not subscribe to singleton store ${singletonStoreId} for org ${orgUid}: datalayer unavailable`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run when singleton subscribe throws',
        );
      });
    });

    it('throws when the singleton store is unsynced and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-unsynced-throw-org-v2';
      const singletonStoreId = 'reconcile-unsynced-throw-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 0, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization({
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `singleton store ${singletonStoreId} for org ${orgUid} not yet synced`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(
          false,
          'subscribeToOrganization must not run while singleton store is unsynced',
        );
      });
    });

    it('returns cleanly when org store data is unavailable and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-org-data-missing-v2';
      const singletonStoreId = 'org-data-missing-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves(null);
        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        await OrganizationsV2.reconcileOrganization(
          {
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          },
          { skipOnUnsynced: true },
        );

        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('throws when org store data fetch fails and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-org-data-error-v2';
      const singletonStoreId = 'org-data-error-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .rejects(new Error('datalayer unavailable'));
        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization({
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: singletonStoreId,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not get current data for org store ${orgUid}: datalayer unavailable`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('returns cleanly when no singleton id can be determined and skipOnUnsynced is true', async function () {
      const orgUid = 'reconcile-missing-singleton-skip-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ name: 'org data without registryId' });
        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        await OrganizationsV2.reconcileOrganization(
          {
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: null,
          },
          { skipOnUnsynced: true },
        );

        expect(subscribeStub.calledOnceWithExactly(orgUid)).to.equal(true);
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('throws when no singleton id can be determined and skipOnUnsynced is false', async function () {
      const orgUid = 'reconcile-missing-singleton-throw-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .withArgs(orgUid)
          .resolves(true);
        sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ name: 'org data without registryId' });
        const subscribeToOrganizationStub = sinon.stub(
          OrganizationsV2,
          'subscribeToOrganization',
        );

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization({
            org_uid: orgUid,
            is_home: false,
            data_model_version_store_id: null,
          });
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(error.message).to.include(
          `could not determine singleton store for org ${orgUid}`,
        );
        expect(subscribeToOrganizationStub.called).to.equal(false);
      });
    });

    it('falls back to the database singleton id when org store data has no registryId', async function () {
      const orgUid = 'reconcile-fallback-org-v2';
      const singletonStoreId = 'fallback-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ name: 'org data without registryId' });

        const subscribeToOrganizationStub = sinon
          .stub(OrganizationsV2, 'subscribeToOrganization')
          .rejects(new Error('stop after fallback pre-checks'));

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization(
            {
              org_uid: orgUid,
              is_home: false,
              data_model_version_store_id: singletonStoreId,
            },
            { skipOnUnsynced: true },
          );
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(subscribeToOrganizationStub.calledOnceWithExactly(orgUid)).to.equal(true);
        expect(subscribeStub.calledWith(singletonStoreId)).to.equal(
          true,
          'singleton pre-check must fall back to the database singleton id',
        );
        expect(syncStatusStub.calledWith(singletonStoreId)).to.equal(true);
      });
    });

    it('reaches subscribeToOrganization after org-derived singleton pre-checks pass', async function () {
      const orgUid = 'reconcile-happy-org-v2';
      const staleSingletonStoreId = 'stale-singleton-v2';
      const singletonStoreId = 'org-derived-singleton-v2';

      await withProductionConfig(async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');
        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);

        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(orgUid)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(singletonStoreId)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        sinon
          .stub(datalayerModule.default, 'getCurrentStoreData')
          .withArgs(orgUid)
          .resolves({ registryId: singletonStoreId });

        const subscribeToOrganizationStub = sinon
          .stub(OrganizationsV2, 'subscribeToOrganization')
          .rejects(new Error('stop after pre-checks'));

        let error = null;
        try {
          await OrganizationsV2.reconcileOrganization(
            {
              org_uid: orgUid,
              is_home: false,
              data_model_version_store_id: staleSingletonStoreId,
            },
            { skipOnUnsynced: true },
          );
        } catch (e) {
          error = e;
        }

        expect(error).to.exist;
        expect(subscribeToOrganizationStub.calledOnceWithExactly(orgUid)).to.equal(true);
        expect(subscribeStub.calledWith(singletonStoreId)).to.equal(
          true,
          'singleton pre-check must use the org-store-derived singleton id',
        );
        expect(subscribeStub.calledWith(staleSingletonStoreId)).to.equal(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // skipOnUnsynced option contract
  // ─────────────────────────────────────────────────────────

  describe('skipOnUnsynced option contract', function () {
    it('V1 should accept { skipOnUnsynced: true } without error in simulator mode', async function () {
      const org = {
        orgUid: 'some-org-v1',
        name: 'Some Org',
        registryId: 'reg-v1',
        dataModelVersionStoreId: 'singleton-v1',
        isHome: false,
      };
      let threw = false;
      try {
        await Organization.reconcileOrganization(org, { skipOnUnsynced: true });
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });

    it('V1 should accept { skipOnUnsynced: false } (default) without error in simulator mode', async function () {
      // In simulator mode the whole function short-circuits before hitting the
      // pre-check block that's affected by this option; the option must still
      // parse without throwing a signature error.
      const org = {
        orgUid: 'some-org-v1',
        name: 'Some Org',
        registryId: 'reg-v1',
        dataModelVersionStoreId: 'singleton-v1',
        isHome: false,
      };
      let threw = false;
      try {
        await Organization.reconcileOrganization(org, { skipOnUnsynced: false });
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });

    it('V1 should accept no-option call (back-compat with pre-PR signature)', async function () {
      const org = {
        orgUid: 'some-org-v1',
        name: 'Some Org',
        registryId: 'reg-v1',
        dataModelVersionStoreId: 'singleton-v1',
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

    it('V2 should accept { skipOnUnsynced: true } without a signature error', async function () {
      // Unknown org in simulator mode will throw from subscribeToOrganization,
      // but the option itself must parse cleanly.
      let errorMessage = null;
      try {
        await OrganizationsV2.reconcileOrganization(
          { org_uid: 'skip-true-v2', is_home: false, data_model_version_store_id: 'singleton' },
          { skipOnUnsynced: true },
        );
      } catch (e) {
        errorMessage = e.message;
      }
      // If we got an error, it must NOT be a signature/argument error.
      if (errorMessage) {
        expect(errorMessage).to.not.match(/options|skipOnUnsynced/i);
      }
    });

    it('V2 should accept { skipOnUnsynced: false } (default) without a signature error', async function () {
      let errorMessage = null;
      try {
        await OrganizationsV2.reconcileOrganization(
          { org_uid: 'skip-false-v2', is_home: false, data_model_version_store_id: 'singleton' },
          { skipOnUnsynced: false },
        );
      } catch (e) {
        errorMessage = e.message;
      }
      if (errorMessage) {
        expect(errorMessage).to.not.match(/options|skipOnUnsynced/i);
      }
    });

    it('V2 should accept no-option call (back-compat with pre-PR signature)', async function () {
      let errorMessage = null;
      try {
        await OrganizationsV2.reconcileOrganization({
          org_uid: 'no-option-v2',
          is_home: false,
          data_model_version_store_id: 'singleton',
        });
      } catch (e) {
        errorMessage = e.message;
      }
      if (errorMessage) {
        expect(errorMessage).to.not.match(/options|skipOnUnsynced/i);
      }
    });
  });
});
