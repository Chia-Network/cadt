import { expect } from 'chai';
import sinon from 'sinon';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { FilestoreV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { FileStore } from '../../../src/models/file-store/index.js';
import { Organization } from '../../../src/models/organizations/index.js';
import datalayer from '../../../src/datalayer/index.js';
import pendingFileStoreCreations, {
  fileStoreIdsPendingOrgStorePush,
} from '../../../src/datalayer/pending-file-store-creations.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

const RETRY_LATER_MESSAGE =
  'New File store being created, please try again later.';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const waitFor = async (condition, timeoutMs = 5000) => {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((res) => setTimeout(res, 10));
  }
};

const expectRetryLater = async (invoke) => {
  try {
    await invoke();
    expect.fail('Should have thrown the retry-later error');
  } catch (error) {
    expect(error.message).to.equal(RETRY_LATER_MESSAGE);
  }
};

describe('File store creation dedup', function () {
  this.timeout(30000);

  let sandbox;
  let testOrgUid;

  before(async function () {
    await prepareV2Db();
    await FilestoreV2.destroy({ where: {} });
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  beforeEach(async function () {
    sandbox = sinon.createSandbox();
    pendingFileStoreCreations.clear();
    fileStoreIdsPendingOrgStorePush.clear();
    await OrganizationsV2.update(
      { file_store_subscribed: null },
      { where: { org_uid: testOrgUid } },
    );
  });

  afterEach(function () {
    sandbox.restore();
    pendingFileStoreCreations.clear();
    fileStoreIdsPendingOrgStorePush.clear();
  });

  describe('v2 model', function () {
    it('mints at most one store for concurrent callers, each of which gets the retry-later error', async function () {
      const coinGate = deferred();
      const waitForSpendableCoins = sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .returns(coinGate.promise);
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('new-store-id');
      const syncDataLayer = sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() =>
        FilestoreV2.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA=='),
      );
      await expectRetryLater(() =>
        FilestoreV2.addFileToFileStore('sha-2', 'b.txt', 'dGVzdA=='),
      );
      await expectRetryLater(() => FilestoreV2.getFileStoreList());
      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await expectRetryLater(() => FilestoreV2.deleteFileStoreItem('sha-1'));

      expect(pendingFileStoreCreations.has(testOrgUid)).to.equal(true);
      await waitFor(() => waitForSpendableCoins.callCount === 1);

      coinGate.resolve({ success: true, coinCount: 1 });
      await waitFor(() => pendingFileStoreCreations.size === 0);
      await waitFor(() => syncDataLayer.callCount === 1);

      expect(createStore.callCount).to.equal(1);
      expect(
        syncDataLayer.calledWithExactly(testOrgUid, {
          fileStoreId: 'new-store-id',
        }),
      ).to.equal(true);

      const org = await OrganizationsV2.findOne({
        where: { org_uid: testOrgUid },
        raw: true,
      });
      expect(org.file_store_subscribed).to.equal('new-store-id');
    });

    it('persists the store id before syncing, so a sync failure does not cause a second mint', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('store-abc');
      const syncDataLayer = sandbox.stub(datalayer, 'syncDataLayer');
      syncDataLayer.onFirstCall().rejects(new Error('push failed'));
      syncDataLayer.resolves();

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(() => pendingFileStoreCreations.size === 0);

      const org = await OrganizationsV2.findOne({
        where: { org_uid: testOrgUid },
        raw: true,
      });
      expect(org.file_store_subscribed).to.equal('store-abc');

      // The persisted id must be used as-is; no new store may be created.
      await FilestoreV2.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA==');
      expect(createStore.callCount).to.equal(1);
    });

    it('releases the pending guard once the id is persisted, so the v1 model can adopt it while the org-store push is still running', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('slow-sync-store');
      const syncGate = deferred();
      const syncDataLayer = sandbox
        .stub(datalayer, 'syncDataLayer')
        .returns(syncGate.promise);

      try {
        await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
        await waitFor(() => syncDataLayer.callCount === 1);

        // The push is still in flight, but the store is minted and recorded,
        // so the guard has done its job and must no longer be held.
        expect(pendingFileStoreCreations.has(testOrgUid)).to.equal(false);
        const v2Org = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        expect(v2Org.file_store_subscribed).to.equal('slow-sync-store');

        // The v1 side of the same upgraded org adopts that id rather than
        // waiting out the push or minting a second store.
        sandbox
          .stub(Organization, 'getHomeOrg')
          .resolves({ orgUid: testOrgUid, fileStoreId: null });
        sandbox.stub(Organization, 'findOne').resolves(null);
        const orgUpdate = sandbox.stub(Organization, 'update').resolves([1]);

        await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
        await waitFor(() => pendingFileStoreCreations.size === 0);

        expect(createStore.callCount).to.equal(1);
        expect(syncDataLayer.callCount).to.equal(1);
        expect(
          orgUpdate.calledWithExactly(
            { fileStoreId: 'slow-sync-store' },
            { where: { orgUid: testOrgUid } },
          ),
        ).to.equal(true);
      } finally {
        syncGate.resolve();
      }
    });

    it('re-adopts the in-flight id when reconciliation clears the recorded id mid-push', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('race-store-id');
      const syncGate = deferred();
      const syncDataLayer = sandbox
        .stub(datalayer, 'syncDataLayer')
        .returns(syncGate.promise);

      try {
        await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
        await waitFor(() => syncDataLayer.callCount === 1);

        // Reconciliation takes the org store as the source of truth, and the
        // org store has no fileStoreId until the push above lands.
        await OrganizationsV2.update(
          { file_store_subscribed: null },
          { where: { org_uid: testOrgUid } },
        );

        await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
        await waitFor(async () => {
          const org = await OrganizationsV2.findOne({
            where: { org_uid: testOrgUid },
            raw: true,
          });
          return org?.file_store_subscribed === 'race-store-id';
        });

        // The store was already paid for, so it must be re-adopted rather
        // than replaced.
        expect(createStore.callCount).to.equal(1);
        expect(syncDataLayer.callCount).to.equal(1);
      } finally {
        syncGate.resolve();
      }
    });

    it('keeps the in-flight id when the org-store push fails, so the paid-for store is not replaced', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('push-failed-store');
      const syncDataLayer = sandbox
        .stub(datalayer, 'syncDataLayer')
        .rejects(new Error('push failed'));

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(() => syncDataLayer.callCount === 1);

      // A failed push means the org store never receives the id, so
      // reconciliation keeps clearing the recorded one.
      await OrganizationsV2.update(
        { file_store_subscribed: null },
        { where: { org_uid: testOrgUid } },
      );

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(async () => {
        const org = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        return org?.file_store_subscribed === 'push-failed-store';
      });

      expect(createStore.callCount).to.equal(1);
    });

    it('retries a failed org-store push after re-adopting the paid-for store id', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('retry-push-store');
      const syncDataLayer = sandbox.stub(datalayer, 'syncDataLayer');
      syncDataLayer.onFirstCall().rejects(new Error('push failed'));
      syncDataLayer.resolves();

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(() => syncDataLayer.callCount === 1);

      await OrganizationsV2.update(
        { file_store_subscribed: null },
        { where: { org_uid: testOrgUid } },
      );

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(() => syncDataLayer.callCount === 2);

      expect(createStore.callCount).to.equal(1);
      expect(
        syncDataLayer.alwaysCalledWithExactly(testOrgUid, {
          fileStoreId: 'retry-push-store',
        }),
      ).to.equal(true);
      expect(fileStoreIdsPendingOrgStorePush.has(testOrgUid)).to.equal(false);
    });

    it('drops the in-flight id on unsubscribe so it cannot be re-adopted', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox.stub(
        datalayer,
        'createDataLayerStoreWithRetry',
      );
      createStore.onFirstCall().resolves('unsubscribed-store');
      createStore.onSecondCall().resolves('replacement-store');
      const syncDataLayer = sandbox
        .stub(datalayer, 'syncDataLayer')
        .rejects(new Error('push failed'));
      sandbox.stub(datalayer, 'unsubscribeFromDataLayerStore').resolves();

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(() => syncDataLayer.callCount === 1);

      await FilestoreV2.unsubscribeFromFileStore(testOrgUid);

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(async () => {
        const org = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        return org?.file_store_subscribed === 'replacement-store';
      });

      expect(createStore.callCount).to.equal(2);
    });

    it('drops the in-flight id on unsubscribe after reconciliation clears the recorded id', async function () {
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox.stub(
        datalayer,
        'createDataLayerStoreWithRetry',
      );
      createStore.onFirstCall().resolves('cleared-before-unsubscribe');
      createStore.onSecondCall().resolves('replacement-after-cleared');
      const firstSyncGate = deferred();
      const secondSyncGate = deferred();
      const syncDataLayer = sandbox.stub(datalayer, 'syncDataLayer');
      syncDataLayer.onFirstCall().returns(firstSyncGate.promise);
      syncDataLayer.onSecondCall().returns(secondSyncGate.promise);
      const unsubscribeFromDataLayerStore = sandbox
        .stub(datalayer, 'unsubscribeFromDataLayerStore')
        .resolves();

      try {
        await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
        await waitFor(() => syncDataLayer.callCount === 1);

        await OrganizationsV2.update(
          { file_store_subscribed: null },
          { where: { org_uid: testOrgUid } },
        );
        await FilestoreV2.unsubscribeFromFileStore(testOrgUid);

        expect(
          unsubscribeFromDataLayerStore.calledWithExactly(
            'cleared-before-unsubscribe',
          ),
        ).to.equal(true);
        expect(fileStoreIdsPendingOrgStorePush.has(testOrgUid)).to.equal(false);

        await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
        await waitFor(async () => {
          const org = await OrganizationsV2.findOne({
            where: { org_uid: testOrgUid },
            raw: true,
          });
          return org?.file_store_subscribed === 'replacement-after-cleared';
        });

        expect(createStore.callCount).to.equal(2);
        firstSyncGate.resolve();
        await waitFor(
          () =>
            fileStoreIdsPendingOrgStorePush.get(testOrgUid)?.fileStoreId ===
            'replacement-after-cleared',
        );
        secondSyncGate.resolve();
        await waitFor(() => !fileStoreIdsPendingOrgStorePush.has(testOrgUid));
      } finally {
        firstSyncGate.resolve();
        secondSyncGate.resolve();
      }
    });

    it('clears the pending entry after a failed creation so a later request can retry', async function () {
      const waitForSpendableCoins = sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .rejects(new Error('Timeout waiting for coins'));
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('retry-store-id');
      sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() =>
        FilestoreV2.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA=='),
      );
      await waitFor(() => pendingFileStoreCreations.size === 0);

      expect(createStore.callCount).to.equal(0);
      let org = await OrganizationsV2.findOne({
        where: { org_uid: testOrgUid },
        raw: true,
      });
      expect(org.file_store_subscribed).to.equal(null);

      waitForSpendableCoins.resolves({ success: true, coinCount: 1 });

      await expectRetryLater(() =>
        FilestoreV2.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA=='),
      );
      await waitFor(() => pendingFileStoreCreations.size === 0);

      expect(createStore.callCount).to.equal(1);
      org = await OrganizationsV2.findOne({
        where: { org_uid: testOrgUid },
        raw: true,
      });
      expect(org.file_store_subscribed).to.equal('retry-store-id');
    });

    it('adopts an id persisted after the caller read its org snapshot instead of minting another store', async function () {
      // Simulate a caller holding a pre-creation snapshot while the id has
      // already landed in the database.
      await OrganizationsV2.update(
        { file_store_subscribed: 'already-persisted-id' },
        { where: { org_uid: testOrgUid } },
      );
      sandbox.stub(OrganizationsV2, 'getHomeOrg').resolves({
        org_uid: testOrgUid,
        file_store_subscribed: null,
      });

      const waitForSpendableCoins = sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('should-not-exist');
      sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() => FilestoreV2.getFileStoreItem('sha-1'));
      await waitFor(() => pendingFileStoreCreations.size === 0);

      expect(waitForSpendableCoins.callCount).to.equal(0);
      expect(createStore.callCount).to.equal(0);
      const org = await OrganizationsV2.findOne({
        where: { org_uid: testOrgUid },
        raw: true,
      });
      expect(org.file_store_subscribed).to.equal('already-persisted-id');
    });

    it('adopts a store id recorded by the v1 model for an upgraded org', async function () {
      sandbox
        .stub(Organization, 'findOne')
        .resolves({ fileStoreId: 'v1-created-store' });

      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('should-not-exist');
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() =>
        FilestoreV2.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA=='),
      );
      await waitFor(() => pendingFileStoreCreations.size === 0);

      expect(createStore.callCount).to.equal(0);
      const org = await OrganizationsV2.findOne({
        where: { org_uid: testOrgUid },
        raw: true,
      });
      expect(org.file_store_subscribed).to.equal('v1-created-store');
    });

    it('does not start a creation when another holder already has the org pending', async function () {
      const waitForSpendableCoins = sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('should-not-exist');
      sandbox.stub(datalayer, 'syncDataLayer').resolves();

      pendingFileStoreCreations.add(testOrgUid);

      await expectRetryLater(() =>
        FilestoreV2.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA=='),
      );
      await new Promise((res) => setTimeout(res, 50));

      expect(waitForSpendableCoins.callCount).to.equal(0);
      expect(createStore.callCount).to.equal(0);
      expect(pendingFileStoreCreations.has(testOrgUid)).to.equal(true);
    });
  });

  describe('v1 model', function () {
    const v1OrgUid = 'v1-test-org-uid';

    it('dedupes concurrent callers through the same pending set and persists before syncing', async function () {
      sandbox
        .stub(Organization, 'getHomeOrg')
        .resolves({ orgUid: v1OrgUid, fileStoreId: null });
      sandbox.stub(Organization, 'findOne').resolves(null);
      const orgUpdate = sandbox.stub(Organization, 'update').resolves([1]);

      const coinGate = deferred();
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .returns(coinGate.promise);
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('v1-store-id');
      const syncDataLayer = sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
      await expectRetryLater(() =>
        FileStore.addFileToFileStore('sha-1', 'a.txt', 'dGVzdA=='),
      );
      await expectRetryLater(() => FileStore.getFileStoreList());
      await expectRetryLater(() => FileStore.deleteFileStoreItem('sha-1'));

      // Same set instance the v2 model consults, so an upgraded org cannot
      // start one creation per model.
      expect(pendingFileStoreCreations.has(v1OrgUid)).to.equal(true);

      coinGate.resolve({ success: true, coinCount: 1 });
      await waitFor(() => pendingFileStoreCreations.size === 0);
      await waitFor(() => syncDataLayer.callCount === 1);

      expect(createStore.callCount).to.equal(1);
      expect(
        orgUpdate.calledWithExactly(
          { fileStoreId: 'v1-store-id' },
          { where: { orgUid: v1OrgUid } },
        ),
      ).to.equal(true);
      expect(orgUpdate.calledBefore(syncDataLayer)).to.equal(true);
      expect(
        syncDataLayer.calledWithExactly(v1OrgUid, {
          fileStoreId: 'v1-store-id',
        }),
      ).to.equal(true);
    });

    it('releases the pending guard once the id is persisted, so a later caller adopts it while the org-store push is still running', async function () {
      sandbox
        .stub(Organization, 'getHomeOrg')
        .resolves({ orgUid: v1OrgUid, fileStoreId: null });
      const orgFindOne = sandbox.stub(Organization, 'findOne').resolves(null);
      const orgUpdate = sandbox.stub(Organization, 'update').resolves([1]);

      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('v1-slow-sync-store');
      const syncGate = deferred();
      const syncDataLayer = sandbox
        .stub(datalayer, 'syncDataLayer')
        .returns(syncGate.promise);

      try {
        await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
        await waitFor(() => syncDataLayer.callCount === 1);

        // The push is still in flight, but the store is minted and recorded,
        // so the guard has done its job and must no longer be held.
        expect(pendingFileStoreCreations.has(v1OrgUid)).to.equal(false);
        expect(
          orgUpdate.calledWithExactly(
            { fileStoreId: 'v1-slow-sync-store' },
            { where: { orgUid: v1OrgUid } },
          ),
        ).to.equal(true);

        // A request arriving during the push adopts the persisted id instead
        // of minting a second store.
        orgFindOne.resolves({ fileStoreId: 'v1-slow-sync-store' });
        await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
        await waitFor(() => orgUpdate.callCount === 2);

        expect(createStore.callCount).to.equal(1);
        expect(syncDataLayer.callCount).to.equal(1);
      } finally {
        syncGate.resolve();
      }
    });

    it('re-adopts the in-flight id when the recorded id is cleared mid-push', async function () {
      sandbox
        .stub(Organization, 'getHomeOrg')
        .resolves({ orgUid: v1OrgUid, fileStoreId: null });
      // Never reports an id, standing in for a record cleared while the push
      // that would register the store is still running.
      sandbox.stub(Organization, 'findOne').resolves(null);
      const orgUpdate = sandbox.stub(Organization, 'update').resolves([1]);

      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('v1-race-store');
      const syncGate = deferred();
      const syncDataLayer = sandbox
        .stub(datalayer, 'syncDataLayer')
        .returns(syncGate.promise);

      try {
        await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
        await waitFor(() => syncDataLayer.callCount === 1);

        await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
        await waitFor(() => orgUpdate.callCount === 2);

        // The store was already paid for, so it must be re-adopted rather
        // than replaced.
        expect(createStore.callCount).to.equal(1);
        expect(syncDataLayer.callCount).to.equal(1);
        expect(
          orgUpdate.alwaysCalledWithExactly(
            { fileStoreId: 'v1-race-store' },
            { where: { orgUid: v1OrgUid } },
          ),
        ).to.equal(true);
      } finally {
        syncGate.resolve();
      }
    });

    it('adopts a store id recorded by the v2 model for an upgraded org', async function () {
      sandbox
        .stub(Organization, 'getHomeOrg')
        .resolves({ orgUid: testOrgUid, fileStoreId: null });
      sandbox.stub(Organization, 'findOne').resolves(null);
      const orgUpdate = sandbox.stub(Organization, 'update').resolves([1]);

      await OrganizationsV2.update(
        { file_store_subscribed: 'v2-created-store' },
        { where: { org_uid: testOrgUid } },
      );

      const createStore = sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .resolves('should-not-exist');
      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
      await waitFor(() => pendingFileStoreCreations.size === 0);

      expect(createStore.callCount).to.equal(0);
      expect(
        orgUpdate.calledWithExactly(
          { fileStoreId: 'v2-created-store' },
          { where: { orgUid: testOrgUid } },
        ),
      ).to.equal(true);
    });

    it('logs a creation failure and clears the pending entry', async function () {
      sandbox
        .stub(Organization, 'getHomeOrg')
        .resolves({ orgUid: v1OrgUid, fileStoreId: null });
      sandbox.stub(Organization, 'findOne').resolves(null);
      const orgUpdate = sandbox.stub(Organization, 'update').resolves([1]);

      sandbox
        .stub(datalayer, 'waitForSpendableCoins')
        .resolves({ success: true, coinCount: 1 });
      sandbox
        .stub(datalayer, 'createDataLayerStoreWithRetry')
        .rejects(new Error('store creation rejected'));
      sandbox.stub(datalayer, 'syncDataLayer').resolves();

      await expectRetryLater(() => FileStore.getFileStoreItem('sha-1'));
      await waitFor(() => pendingFileStoreCreations.size === 0);

      expect(orgUpdate.callCount).to.equal(0);
      expect(pendingFileStoreCreations.has(v1OrgUid)).to.equal(false);
    });
  });
});
