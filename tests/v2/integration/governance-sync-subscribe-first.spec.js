import { expect } from 'chai';
import sinon from 'sinon';

import { prepareDb } from '../../../src/database/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { GovernanceV2 } from '../../../src/models/v2/index.js';
import TaskManager from '../../../src/tasks/index.js';
import { withConfigOverride } from '../utils/v2-test-helpers.js';

/**
 * Regression test: governance sync must subscribe to the body store BEFORE
 * checking its sync status.
 *
 * Without this ordering, a fresh deployment whose governance body store has
 * never been subscribed gets wedged: `getDataLayerStoreSyncStatus` errors on
 * the DL node (store not in local DB), the CADT wrapper swallows the error
 * and returns `false`, `isDlStoreSynced(undefined)` returns `false`, and
 * sync() returns early. Because sync() is the only place that ever called
 * `subscribeToStoreOnDataLayer` for the governance body (via
 * `getSubscribedStoreData`), the store never gets subscribed and the skip
 * repeats forever on every scheduled run — not a transient retry.
 *
 * The fix mirrors the subscribe-first pattern in
 * `OrganizationsV2.reconcileOrganization`: subscribe first (idempotent), then
 * check sync status.  Both operations are safe to repeat on every run.
 *
 * We only exercise V2 here because the V2 model reads USE_SIMULATOR at call
 * time (so `withConfigOverride` can flip it).  V1's `Governance` model
 * captures USE_SIMULATOR at module import time and the same code path cannot
 * be reached from the test runner — the V1 fix is structurally identical and
 * is reviewed by code reading.
 */
describe('GovernanceV2.sync subscribe-first ordering', function () {
  this.timeout(15000);

  const GOVERNANCE_BODY_ID =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  let originalUseSimulator;
  let originalUseDevMode;

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  beforeEach(function () {
    // The test runner sets USE_SIMULATOR=true, which still overrides YAML.
    // Delete it so withConfigOverride({ APP: { USE_SIMULATOR: false } }) sticks.
    originalUseSimulator = process.env.USE_SIMULATOR;
    originalUseDevMode = process.env.USE_DEVELOPMENT_MODE;
    delete process.env.USE_SIMULATOR;
    delete process.env.USE_DEVELOPMENT_MODE;
  });

  afterEach(async function () {
    sinon.restore();
    if (originalUseSimulator !== undefined) {
      process.env.USE_SIMULATOR = originalUseSimulator;
    }
    if (originalUseDevMode !== undefined) {
      process.env.USE_DEVELOPMENT_MODE = originalUseDevMode;
    }
    await GovernanceV2.destroy({ where: {} });
  });

  it('calls subscribeToStoreOnDataLayer before getDataLayerStoreSyncStatus on unsynced store', async function () {
    await withConfigOverride(
      async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');

        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);
        // Return `false` (matches persistance.js behaviour when the DL node
        // has no record of the store) so isDlStoreSynced() returns false and
        // sync() takes the early-return path we're testing.
        const syncStatusStub = sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .resolves(false);
        // Assert this is NEVER reached on the unsynced path.
        const getDataStub = sinon
          .stub(datalayerModule.default, 'getSubscribedStoreData')
          .resolves({});

        await GovernanceV2.sync();

        expect(subscribeStub.called).to.be.true;
        expect(subscribeStub.firstCall.args[0]).to.equal(GOVERNANCE_BODY_ID);

        expect(syncStatusStub.called).to.be.true;
        expect(syncStatusStub.firstCall.args[0]).to.equal(GOVERNANCE_BODY_ID);

        // The ordering property that fixes the regression:
        expect(subscribeStub.firstCall.calledBefore(syncStatusStub.firstCall))
          .to.equal(
            true,
            'subscribeToStoreOnDataLayer must run before getDataLayerStoreSyncStatus',
          );

        // And we must not fall through to fetching data when the status check
        // fails — that was the old blocking-fetch behaviour we're avoiding.
        expect(getDataStub.called).to.equal(
          false,
          'getSubscribedStoreData must not run when status check fails',
        );
      },
      {
        APP: { USE_SIMULATOR: false, USE_DEVELOPMENT_MODE: false },
        V2: { GOVERNANCE: { GOVERNANCE_BODY_ID } },
      },
    );
  });

  it('returns cleanly (no throw) when subscribeToStoreOnDataLayer fails', async function () {
    await withConfigOverride(
      async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');

        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .rejects(new Error('datalayer unreachable'));
        const syncStatusStub = sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .resolves(false);

        let threw = false;
        try {
          await GovernanceV2.sync();
        } catch {
          threw = true;
        }

        expect(threw).to.equal(
          false,
          'sync() must swallow subscribe failures and let the scheduler retry',
        );
        expect(subscribeStub.calledOnce).to.be.true;
        expect(syncStatusStub.called).to.equal(
          false,
          'status check must be skipped when subscribe fails',
        );
      },
      {
        APP: { USE_SIMULATOR: false, USE_DEVELOPMENT_MODE: false },
        V2: { GOVERNANCE: { GOVERNANCE_BODY_ID } },
      },
    );
  });

  it('treats a falsy return from subscribeToStoreOnDataLayer as a failure', async function () {
    // The production `subscribeToStoreOnDataLayer` wrapper in
    // src/datalayer/persistance.js does NOT throw on the common
    // "datalayer unreachable" / "subscribe RPC failure" paths — it logs
    // and returns `false`.  If the fix only guarded on thrown exceptions,
    // the dominant failure mode would slip past and the subsequent status
    // check would fire with a misleading log.
    await withConfigOverride(
      async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');

        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(false);
        const syncStatusStub = sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });

        let threw = false;
        try {
          await GovernanceV2.sync();
        } catch {
          threw = true;
        }

        expect(threw).to.be.false;
        expect(subscribeStub.calledOnce).to.be.true;
        expect(syncStatusStub.called).to.equal(
          false,
          'status check must be skipped when subscribe returns a falsy value',
        );
      },
      {
        APP: { USE_SIMULATOR: false, USE_DEVELOPMENT_MODE: false },
        V2: { GOVERNANCE: { GOVERNANCE_BODY_ID } },
      },
    );
  });

  it('also subscribes to the versioned governance store before its status check', async function () {
    // Walks the happy path for the body store, then fails the versioned-store
    // status check.  Asserts the full call order:
    //   subscribe(body) -> status(body) -> get-data(body) ->
    //     subscribe(versioned) -> status(versioned) -> (skip)
    // And that the versioned-store sync-status check cannot be reached unless
    // the versioned-store subscribe has already run.
    const VERSIONED_GOVERNANCE_STORE_ID =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    await withConfigOverride(
      async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');

        const subscribeStub = sinon
          .stub(datalayerModule.default, 'subscribeToStoreOnDataLayer')
          .resolves(true);
        const syncStatusStub = sinon.stub(
          datalayerModule.default,
          'getDataLayerStoreSyncStatus',
        );
        syncStatusStub
          .withArgs(GOVERNANCE_BODY_ID)
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });
        syncStatusStub
          .withArgs(VERSIONED_GOVERNANCE_STORE_ID)
          .resolves({ sync_status: { generation: 0, target_generation: 5 } });

        // Body-store data fetch returns a versioned pointer so sync() routes
        // to the versioned-store path.
        const getDataStub = sinon
          .stub(datalayerModule.default, 'getSubscribedStoreData')
          .resolves({ v2: VERSIONED_GOVERNANCE_STORE_ID });

        // Guard: sync must NOT call upsertGovernanceDownload when the
        // versioned-store status check skips.
        const upsertStub = sinon.stub(
          GovernanceV2,
          'upsertGovernanceDownload',
        );

        await GovernanceV2.sync();

        const bodySubscribe = subscribeStub
          .getCalls()
          .find((c) => c.args[0] === GOVERNANCE_BODY_ID);
        const versionedSubscribe = subscribeStub
          .getCalls()
          .find((c) => c.args[0] === VERSIONED_GOVERNANCE_STORE_ID);
        const bodyStatus = syncStatusStub
          .getCalls()
          .find((c) => c.args[0] === GOVERNANCE_BODY_ID);
        const versionedStatus = syncStatusStub
          .getCalls()
          .find((c) => c.args[0] === VERSIONED_GOVERNANCE_STORE_ID);

        expect(bodySubscribe, 'body-store subscribe must run').to.exist;
        expect(bodyStatus, 'body-store status check must run').to.exist;
        expect(getDataStub.called, 'body-store data fetch must run').to.be.true;
        expect(versionedSubscribe, 'versioned-store subscribe must run').to.exist;
        expect(versionedStatus, 'versioned-store status check must run').to.exist;

        // Subscribe must come BEFORE status check for each store.
        expect(bodySubscribe.calledBefore(bodyStatus)).to.equal(
          true,
          'body subscribe must run before body status check',
        );
        expect(versionedSubscribe.calledBefore(versionedStatus)).to.equal(
          true,
          'versioned subscribe must run before versioned status check',
        );

        // Skip path means upsert must never run.
        expect(upsertStub.called).to.equal(
          false,
          'upsertGovernanceDownload must not run when versioned store is unsynced',
        );
      },
      {
        APP: { USE_SIMULATOR: false, USE_DEVELOPMENT_MODE: false },
        V2: { GOVERNANCE: { GOVERNANCE_BODY_ID } },
      },
    );
  });

  it('returns cleanly when the versioned-store subscribe returns falsy', async function () {
    const VERSIONED_GOVERNANCE_STORE_ID =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    await withConfigOverride(
      async () => {
        const datalayerModule = await import('../../../src/datalayer/index.js');

        const subscribeStub = sinon.stub(
          datalayerModule.default,
          'subscribeToStoreOnDataLayer',
        );
        subscribeStub.withArgs(GOVERNANCE_BODY_ID).resolves(true);
        subscribeStub.withArgs(VERSIONED_GOVERNANCE_STORE_ID).resolves(false);

        const syncStatusStub = sinon
          .stub(datalayerModule.default, 'getDataLayerStoreSyncStatus')
          .resolves({ sync_status: { generation: 1, target_generation: 1 } });

        sinon
          .stub(datalayerModule.default, 'getSubscribedStoreData')
          .resolves({ v2: VERSIONED_GOVERNANCE_STORE_ID });

        const upsertStub = sinon.stub(
          GovernanceV2,
          'upsertGovernanceDownload',
        );

        let threw = false;
        try {
          await GovernanceV2.sync();
        } catch {
          threw = true;
        }

        expect(threw).to.be.false;

        const versionedStatusCalled = syncStatusStub
          .getCalls()
          .some((c) => c.args[0] === VERSIONED_GOVERNANCE_STORE_ID);
        expect(versionedStatusCalled).to.equal(
          false,
          'versioned-store status check must be skipped when versioned subscribe returns falsy',
        );
        expect(upsertStub.called).to.equal(
          false,
          'upsertGovernanceDownload must not run when versioned subscribe fails',
        );
      },
      {
        APP: { USE_SIMULATOR: false, USE_DEVELOPMENT_MODE: false },
        V2: { GOVERNANCE: { GOVERNANCE_BODY_ID } },
      },
    );
  });
});

describe('GovernanceV2.sync cache preservation (simulator mode)', function () {
  this.timeout(10000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  afterEach(async function () {
    await GovernanceV2.destroy({ where: {} });
  });

  it('should not remove previously cached orgList when only pickList is written', async function () {
    await GovernanceV2.upsert({
      meta_key: 'orgList',
      meta_value: JSON.stringify({ orgs: ['existing-org'] }),
      confirmed: true,
    });

    await GovernanceV2.sync();

    const orgList = await GovernanceV2.findOne({ where: { meta_key: 'orgList' } });
    expect(orgList).to.exist;
    expect(JSON.parse(orgList.meta_value)).to.deep.equal({ orgs: ['existing-org'] });
  });

  it('should not remove previously cached glossary when only pickList is written', async function () {
    await GovernanceV2.upsert({
      meta_key: 'glossary',
      meta_value: JSON.stringify({ terms: ['carbon credit'] }),
      confirmed: true,
    });

    await GovernanceV2.sync();

    const glossary = await GovernanceV2.findOne({ where: { meta_key: 'glossary' } });
    expect(glossary).to.exist;
    expect(JSON.parse(glossary.meta_value)).to.deep.equal({ terms: ['carbon credit'] });
  });
});
