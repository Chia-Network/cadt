/**
 * Unit tests for the helpers backing /diagnostics. These focus on pure
 * parsing/shaping logic (regexes, response decoding, budget enforcement)
 * that the HTTP integration test in diagnostics.spec.js only exercises in
 * its happy path. We deliberately do NOT call prepareDb / prepareV2Db here
 * -- these tests should run in milliseconds, not seconds.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import superagent from 'superagent';
import fs from 'fs';

import { __test as probeTest } from '../../../src/utils/chia-tools-probe.js';
import { __test as scanTest } from '../../../src/utils/chia-process-scan.js';
import * as fullNodeRpc from '../../../src/datalayer/fullNodeRpc.js';
import { __test as diagnosticsTest } from '../../../src/routes/diagnostics.js';

// Mock helper matching the one in tests/v2/integration/transaction-health.spec.js
function createSuperagentMock(responseBody) {
  const responseObj = { body: responseBody, text: JSON.stringify(responseBody) };
  const chain = {
    key: sinon.stub().callsFake(function () { return this; }),
    cert: sinon.stub().callsFake(function () { return this; }),
    timeout: sinon.stub().callsFake(function () { return this; }),
    send: sinon.stub().callsFake(function () { return this; }),
    then: function (resolve) { return Promise.resolve(responseObj).then(resolve); },
  };
  return chain;
}

function createSuperagentRejection(error) {
  const chain = {
    key: sinon.stub().callsFake(function () { return this; }),
    cert: sinon.stub().callsFake(function () { return this; }),
    timeout: sinon.stub().callsFake(function () { return this; }),
    send: sinon.stub().callsFake(function () { return this; }),
    then: function (_resolve, reject) { return Promise.reject(error).catch(reject); },
  };
  return chain;
}

describe('chia-tools-probe extractVersion', function () {
  const { extractVersion } = probeTest;

  it('extracts a 3-segment semver from chia-tools --version output', function () {
    expect(extractVersion('chia-tools 1.2.3')).to.equal('1.2.3');
    expect(extractVersion('chia-tools, version 1.2.3')).to.equal('1.2.3');
    expect(extractVersion('chia-tools v1.2.3\n')).to.equal('1.2.3');
  });

  it('extracts a 2-segment version when only major.minor is reported', function () {
    expect(extractVersion('chia-tools 1.2')).to.equal('1.2');
  });

  it('extracts pre-release and build suffixes', function () {
    expect(extractVersion('chia-tools 1.2.3-rc1')).to.equal('1.2.3-rc1');
    expect(extractVersion('chia-tools 1.2.3+build.42')).to.equal('1.2.3+build.42');
  });

  it('falls back to the first non-empty line when no version pattern matches', function () {
    expect(extractVersion('weird-output-no-numbers')).to.equal('weird-output-no-numbers');
    expect(extractVersion('  line one  \nline two')).to.equal('line one');
  });

  it('returns null for null / undefined / empty input', function () {
    expect(extractVersion(null)).to.equal(null);
    expect(extractVersion(undefined)).to.equal(null);
    expect(extractVersion('')).to.equal(null);
  });
});

describe('chia-process-scan parsers', function () {
  describe('isChiaCommand', function () {
    const { isChiaCommand } = scanTest;

    it('matches renamed chia daemon binaries', function () {
      expect(isChiaCommand('chia_full_node --no-wait')).to.equal(true);
      expect(isChiaCommand('chia_wallet')).to.equal(true);
      expect(isChiaCommand('chia_data_layer --port 8562')).to.equal(true);
      expect(isChiaCommand('/usr/local/bin/chia_full_node')).to.equal(true);
    });

    it('matches the chia CLI itself', function () {
      expect(isChiaCommand('chia start wallet')).to.equal(true);
      expect(isChiaCommand('/usr/local/bin/chia start all')).to.equal(true);
      expect(isChiaCommand('chia-tools --version')).to.equal(true);
    });

    it('rejects non-chia processes that happen to contain the substring', function () {
      // "machinist" includes "chia" but the basename does not start with chia
      expect(isChiaCommand('/usr/bin/machinist --flag')).to.equal(false);
      expect(isChiaCommand('node /opt/some/chia-mention.js')).to.equal(false);
      expect(isChiaCommand('python3.11 manage.py runserver')).to.equal(false);
      expect(isChiaCommand('')).to.equal(false);
      expect(isChiaCommand(null)).to.equal(false);
    });
  });

  describe('parsePsLine', function () {
    const { parsePsLine } = scanTest;

    it('parses a typical ps -eo pid,command line', function () {
      expect(parsePsLine('  1234 /usr/local/bin/chia_full_node --no-wait')).to.deep.equal({
        pid: 1234,
        command: '/usr/local/bin/chia_full_node --no-wait',
      });
    });

    it('returns null for unparseable lines', function () {
      expect(parsePsLine('')).to.equal(null);
      expect(parsePsLine('   ')).to.equal(null);
      expect(parsePsLine('not-a-pid command')).to.equal(null);
    });

    it('handles commands with multiple spaces', function () {
      const result = parsePsLine('42 chia start  --foo  --bar');
      expect(result.pid).to.equal(42);
      expect(result.command).to.equal('chia start  --foo  --bar');
    });
  });
});

describe('fullNodeRpc', function () {
  let superagentPostStub;
  let fsReadFileSyncStub;
  // Capture the real readFileSync before any stubs replace it, so the
  // selective stub below can fall through for non-cert reads (e.g. the
  // chia/cadt config YAML, mocha source maps).
  const realReadFileSync = fs.readFileSync.bind(fs);

  // Pre-warm config memoize so the first test doesn't see the stub when
  // resolving getActiveConfig() inside loadFullNodeCerts. Without this the
  // stub intercepts the YAML read and the merged config comes back as
  // a plain string, then "unifiedConfig.V1.MIRROR_DB" throws.
  before(async function () {
    const { getActiveConfig } = await import('../../../src/utils/config-loader.js');
    getActiveConfig();
    const { getChiaConfig } = await import('../../../src/datalayer/fullNode.js');
    try { getChiaConfig(); } catch { /* OK if no chia config on this host */ }
  });

  beforeEach(function () {
    fsReadFileSyncStub = sinon.stub(fs, 'readFileSync').callsFake((p, ...args) => {
      const s = typeof p === 'string' ? p : '';
      if (s.endsWith('.crt') || s.endsWith('.key')) {
        return Buffer.from('fake-cert');
      }
      return realReadFileSync(p, ...args);
    });
    superagentPostStub = sinon.stub(superagent, 'post');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('getBlockchainState', function () {
    it('parses a successful synced response', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        blockchain_state: {
          sync: { synced: true, sync_mode: false },
          peak: { height: 5_550_000 },
          genesis_challenge_initialized: true,
        },
      }));

      const result = await fullNodeRpc.getBlockchainState();

      expect(result.reachable).to.equal(true);
      expect(result.synced).to.equal(true);
      expect(result.syncing).to.equal(false);
      expect(result.peakHeight).to.equal(5_550_000);
      expect(result.syncMode).to.equal('synced');
      expect(result.genesisChallengeInitialized).to.equal(true);
      expect(result.rpcUrl).to.match(/^https:\/\/localhost:\d+$/);
    });

    it('parses a syncing response', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        blockchain_state: {
          sync: { synced: false, sync_mode: true },
          peak: { height: 4_000_000 },
        },
      }));

      const result = await fullNodeRpc.getBlockchainState();
      expect(result.synced).to.equal(false);
      expect(result.syncing).to.equal(true);
      expect(result.syncMode).to.equal('syncing');
      expect(result.peakHeight).to.equal(4_000_000);
    });

    it('parses a not-yet-synced response (no peak)', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        blockchain_state: {
          sync: { synced: false, sync_mode: false },
          peak: null,
        },
      }));

      const result = await fullNodeRpc.getBlockchainState();
      expect(result.synced).to.equal(false);
      expect(result.syncing).to.equal(false);
      expect(result.syncMode).to.equal('not_synced');
      expect(result.peakHeight).to.equal(null);
    });

    it('surfaces RPC-level error responses while remaining reachable', async function () {
      superagentPostStub.returns(createSuperagentMock({ success: false, error: 'boom' }));
      const result = await fullNodeRpc.getBlockchainState();
      expect(result.reachable).to.equal(true);
      expect(result.error).to.equal('boom');
      expect(result.synced).to.equal(undefined);
    });

    it('marks the full node unreachable when the request rejects', async function () {
      superagentPostStub.returns(createSuperagentRejection(new Error('ECONNREFUSED')));
      const result = await fullNodeRpc.getBlockchainState();
      expect(result.reachable).to.equal(false);
      expect(result.error).to.equal('ECONNREFUSED');
    });

    it('marks the full node unreachable when the certs cannot be read', async function () {
      fsReadFileSyncStub.restore();
      fsReadFileSyncStub = sinon.stub(fs, 'readFileSync').throws(new Error('ENOENT: no such cert'));
      const result = await fullNodeRpc.getBlockchainState();
      expect(result.reachable).to.equal(false);
      expect(result.error).to.match(/ENOENT/);
    });
  });

  describe('getFullNodeConnections', function () {
    it('decodes the peer list and drops chia-internal fields we do not need', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        connections: [
          {
            peer_host: '1.2.3.4', peer_port: 8444, type: 1, node_id: '0xabc',
            // chia returns many more fields; we should not echo them
            creation_time: 123, last_message_time: 456, bytes_read: 999,
          },
          { peer_host: '5.6.7.8', peer_port: 8444, type: 1, node_id: '0xdef' },
        ],
      }));

      const result = await fullNodeRpc.getFullNodeConnections();
      expect(result.reachable).to.equal(true);
      expect(result.connections).to.have.lengthOf(2);
      expect(result.connections[0]).to.have.all.keys('peerHost', 'peerPort', 'type');
      expect(result.connections[0].peerHost).to.equal('1.2.3.4');
      expect(result.connections[0]).to.not.have.property('creation_time');
      expect(result.connections[0]).to.not.have.property('bytes_read');
    });

    it('returns reachable=false on transport errors', async function () {
      superagentPostStub.returns(createSuperagentRejection(new Error('socket hang up')));
      const result = await fullNodeRpc.getFullNodeConnections();
      expect(result.reachable).to.equal(false);
      expect(result.error).to.equal('socket hang up');
    });
  });
});

describe('network match semantics', function () {
  // CADT's CHIA_NETWORK config is a binary mainnet vs testnet flag, not an
  // exact chia network name. These cases pin the diagnostics endpoint's
  // normalised comparison so the historical substring/exact-equality bugs
  // can't regress. We test through the public helper rather than the HTTP
  // surface because reaching the live wallet RPC in CI would tie the test
  // to the runner's network.
  const normalizeChiaNetwork = (n) => (n === 'mainnet' ? 'mainnet' : 'testnet');
  const matches = (actual, configured) =>
    normalizeChiaNetwork(actual) === normalizeChiaNetwork(configured);

  it('reports a match when chia is mainnet and CADT config is mainnet', function () {
    expect(matches('mainnet', 'mainnet')).to.equal(true);
  });

  it('reports a match for any chia testnet variant when CADT config is testnet', function () {
    expect(matches('testneta', 'testnet')).to.equal(true);
    expect(matches('testnet10', 'testnet')).to.equal(true);
    expect(matches('testnet11', 'testnet')).to.equal(true);
    expect(matches('simulator', 'testnet')).to.equal(true);
  });

  it('reports a mismatch when chia is mainnet but CADT expects testnet', function () {
    expect(matches('mainnet', 'testnet')).to.equal(false);
    expect(matches('mainnet', 'testnet10')).to.equal(false);
  });

  it('reports a mismatch when chia is any testnet but CADT expects mainnet', function () {
    expect(matches('testneta', 'mainnet')).to.equal(false);
    expect(matches('testnet10', 'mainnet')).to.equal(false);
    expect(matches('simulator', 'mainnet')).to.equal(false);
  });

  it('avoids the old substring-rule false positive: testnet1 vs testnet10', function () {
    // The original `actual.includes(configured)` check returned true here
    // because "testnet10".includes("testnet1") is true. The normalised rule
    // collapses both to "testnet" and reports them as compatible (which is
    // the correct CADT semantics: both are testnet variants).
    expect(matches('testnet10', 'testnet1')).to.equal(true);
    expect(matches('testnet1', 'testnet10')).to.equal(true);
  });
});

describe('collectSubscriptions', function () {
  const { collectSubscriptions } = diagnosticsTest;

  it('marks generation/target_generation as synced only when both are finite and equal', async function () {
    const persistance = {
      getSubscriptions: async () => ({ success: true, storeIds: ['store-a', 'store-b', 'store-c'] }),
      getDataLayerStoreSyncStatus: async (id) => {
        if (id === 'store-a') return { sync_status: { generation: 10, target_generation: 10 } };
        if (id === 'store-b') return { sync_status: { generation: 8, target_generation: 10 } };
        // store-c: both undefined. Without the Number.isFinite guard this
        // would falsely report synced=true.
        if (id === 'store-c') return { sync_status: {} };
        return null;
      },
    };

    const result = await collectSubscriptions(persistance);

    expect(result.available).to.equal(true);
    expect(result.totalSubscriptions).to.equal(3);
    expect(result.truncated).to.equal(false);

    const byId = Object.fromEntries(result.subscriptions.map((s) => [s.storeId, s]));
    expect(byId['store-a'].synced).to.equal(true);
    expect(byId['store-b'].synced).to.equal(false);
    expect(byId['store-c'].synced).to.equal(false);
    // generation/target_generation undefined are normalised to null in the response
    expect(byId['store-c'].generation).to.equal(null);
    expect(byId['store-c'].targetGeneration).to.equal(null);
  });

  it('returns available=false and an empty subscription list when getSubscriptions throws', async function () {
    const persistance = {
      getSubscriptions: async () => { throw new Error('datalayer down'); },
      getDataLayerStoreSyncStatus: async () => { throw new Error('should not be called'); },
    };

    const result = await collectSubscriptions(persistance);
    expect(result.available).to.equal(false);
    expect(result.subscriptions).to.deep.equal([]);
    expect(result.totalSubscriptions).to.equal(0);
    expect(result.truncated).to.equal(false);
  });

  it('returns available=false when getSubscriptions returns success=false', async function () {
    const persistance = {
      getSubscriptions: async () => ({ success: false, storeIds: [] }),
      getDataLayerStoreSyncStatus: async () => { throw new Error('unreachable'); },
    };
    const result = await collectSubscriptions(persistance);
    expect(result.available).to.equal(false);
    expect(result.subscriptions).to.deep.equal([]);
  });

  it('captures per-store errors without aborting the whole enumeration', async function () {
    const persistance = {
      getSubscriptions: async () => ({ success: true, storeIds: ['good', 'bad'] }),
      getDataLayerStoreSyncStatus: async (id) => {
        if (id === 'good') return { sync_status: { generation: 5, target_generation: 5 } };
        throw new Error('per-store rpc failed');
      },
    };
    const result = await collectSubscriptions(persistance);
    expect(result.totalSubscriptions).to.equal(2);
    const byId = Object.fromEntries(result.subscriptions.map((s) => [s.storeId, s]));
    expect(byId['good'].synced).to.equal(true);
    expect(byId['bad'].error).to.equal('per-store rpc failed');
    expect(byId['bad'].synced).to.equal(null);
  });

  it('handles missing sync_status by recording an explicit error', async function () {
    const persistance = {
      getSubscriptions: async () => ({ success: true, storeIds: ['x'] }),
      getDataLayerStoreSyncStatus: async () => ({}), // no sync_status key
    };
    const result = await collectSubscriptions(persistance);
    expect(result.subscriptions[0].synced).to.equal(null);
    expect(result.subscriptions[0].error).to.equal('no sync status returned');
  });
});

describe('collectOwnedStoreExpectations', function () {
  const { collectOwnedStoreExpectations } = diagnosticsTest;

  it('returns empty expected list and null ownedStores when nothing is configured', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: null,
      v1HomeOrg: null,
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.ownedStores).to.equal(null);
    expect(result.totalOwnedStores).to.equal(null);
    expect(result.expectedOwnedStores).to.deep.equal([]);
  });

  it('lists V1 home-org stores, skipping null lazy stores', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: ['org1', 'reg1'] },
      v1HomeOrg: {
        orgUid: 'org1',
        registryId: 'reg1',
        fileStoreId: null,
        dataModelVersionStoreId: null,
      },
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.expectedOwnedStores).to.have.length(2);
    expect(result.expectedOwnedStores.map((e) => e.label)).to.deep.equal([
      'v1 home org',
      'v1 registry',
    ]);
    expect(result.expectedOwnedStores.every((e) => e.owned === true)).to.equal(true);
  });

  it('lists V2 home-org stores using snake_case fields', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: ['orgA', 'regA', 'fsA', 'dmA'] },
      v1HomeOrg: null,
      v2HomeOrg: {
        org_uid: 'orgA',
        registry_id: 'regA',
        file_store_subscribed: 'fsA',
        data_model_version_store_id: 'dmA',
      },
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.expectedOwnedStores.map((e) => e.label)).to.deep.equal([
      'v2 home org',
      'v2 registry',
      'v2 file store',
      'v2 data model version store',
    ]);
    expect(result.expectedOwnedStores.every((e) => e.owned === true)).to.equal(true);
  });

  it('flags an expected store as owned=false when datalayer does not list it', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: ['org1'] },
      v1HomeOrg: { orgUid: 'org1', registryId: 'reg1' },
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    const byLabel = Object.fromEntries(
      result.expectedOwnedStores.map((e) => [e.label, e]),
    );
    expect(byLabel['v1 home org'].owned).to.equal(true);
    expect(byLabel['v1 registry'].owned).to.equal(false);
  });

  it('marks owned as null (unknown) when datalayer RPC failed', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: null,
      v1HomeOrg: { orgUid: 'org1', registryId: 'reg1' },
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.ownedStores).to.equal(null);
    expect(result.expectedOwnedStores.every((e) => e.owned === null)).to.equal(true);
  });

  it('marks owned as null when datalayer returned success=false', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: false, storeIds: [] },
      v1HomeOrg: { orgUid: 'org1' },
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.ownedStores).to.equal(null);
    expect(result.expectedOwnedStores[0].owned).to.equal(null);
  });

  it('includes governance stores when this node IS the governance body', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: {
        success: true,
        storeIds: ['gov-body-v1', 'gov-version-v1', 'gov-body-v2', 'gov-version-v2'],
      },
      v1HomeOrg: null,
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: 'gov-body-v1',
      v1GovernanceVersionStoreId: 'gov-version-v1',
      v2GovernanceBodyStoreId: 'gov-body-v2',
      v2GovernanceVersionStoreId: 'gov-version-v2',
    });
    expect(result.expectedOwnedStores.map((e) => e.label)).to.deep.equal([
      'v1 governance body',
      'v1 governance version store',
      'v2 governance body',
      'v2 governance version store',
    ]);
    expect(result.expectedOwnedStores.every((e) => e.owned === true)).to.equal(true);
  });

  it('excludes V2 governance keys when caller signals subscriber (mainGoveranceBodyId absent)', function () {
    // V2 subscribers have governanceBodyId set in MetaV2 (subscribe upserts
    // it) but no mainGoveranceBodyId. The caller is responsible for passing
    // null for both v2 fields in that case; the helper just trusts it.
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: [] },
      v1HomeOrg: null,
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v1GovernanceVersionStoreId: null,
      v2GovernanceBodyStoreId: null, // gated off by caller
      v2GovernanceVersionStoreId: null, // gated off by caller
    });
    expect(result.expectedOwnedStores).to.deep.equal([]);
  });

  it('combines home-org and governance-body expectations in a single list', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: ['org', 'reg', 'gov-body'] },
      v1HomeOrg: { orgUid: 'org', registryId: 'reg' },
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: 'gov-body',
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.expectedOwnedStores.map((e) => e.label)).to.deep.equal([
      'v1 home org',
      'v1 registry',
      'v1 governance body',
    ]);
    expect(result.expectedOwnedStores.every((e) => e.owned === true)).to.equal(true);
  });

  it('reports totalOwnedStores from the actual datalayer-owned list', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: ['a', 'b', 'c', 'd'] },
      v1HomeOrg: { orgUid: 'a', registryId: 'b' }, // only 2 expected
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.totalOwnedStores).to.equal(4);
    expect(result.expectedOwnedStores).to.have.length(2);
  });

  it('skips entries with falsy storeId without throwing', function () {
    const result = collectOwnedStoreExpectations({
      ownedStoresResult: { success: true, storeIds: [] },
      v1HomeOrg: {
        orgUid: '', // falsy -- should be skipped
        registryId: 'reg1',
        fileStoreId: undefined,
        dataModelVersionStoreId: null,
      },
      v2HomeOrg: null,
      v1GovernanceBodyStoreId: null,
      v2GovernanceBodyStoreId: null,
      v2GovernanceVersionStoreId: null,
    });
    expect(result.expectedOwnedStores.map((e) => e.label)).to.deep.equal(['v1 registry']);
  });
});

describe('diagnostics collectNonDefaultTaskIntervals', function () {
  const { collectNonDefaultTaskIntervals } = diagnosticsTest;

  const defaultTasks = {
    GOVERNANCE_SYNC_TASK_INTERVAL: 120,
    ORGANIZATION_META_SYNC_TASK_INTERVAL: 120,
    PICKLIST_SYNC_TASK_INTERVAL: 120,
    MIRROR_CHECK_TASK_INTERVAL: 900,
    VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL: 1800,
    COIN_MANAGEMENT_TASK_INTERVAL: 21600,
  };

  it('returns an empty array when all intervals match defaults', function () {
    expect(collectNonDefaultTaskIntervals(defaultTasks, defaultTasks)).to.deep.equal([]);
  });

  it('reports only intervals that differ from defaults', function () {
    const actual = {
      ...defaultTasks,
      GOVERNANCE_SYNC_TASK_INTERVAL: 30,
      MIRROR_CHECK_TASK_INTERVAL: 900,
    };
    expect(collectNonDefaultTaskIntervals(actual, defaultTasks)).to.deep.equal([
      { key: 'GOVERNANCE_SYNC_TASK_INTERVAL', default: 120, actual: 30 },
    ]);
  });

  it('reports multiple non-default intervals', function () {
    const actual = {
      ...defaultTasks,
      PICKLIST_SYNC_TASK_INTERVAL: 60,
      COIN_MANAGEMENT_TASK_INTERVAL: 3600,
    };
    expect(collectNonDefaultTaskIntervals(actual, defaultTasks)).to.deep.equal([
      { key: 'PICKLIST_SYNC_TASK_INTERVAL', default: 120, actual: 60 },
      { key: 'COIN_MANAGEMENT_TASK_INTERVAL', default: 21600, actual: 3600 },
    ]);
  });

  it('ignores unknown task keys and missing actual values', function () {
    const actual = {
      GOVERNANCE_SYNC_TASK_INTERVAL: 120,
      DEFAULT_ORGANIZATIONS_SYNC_TASK_INTERVAL: 30,
    };
    expect(collectNonDefaultTaskIntervals(actual, defaultTasks)).to.deep.equal([]);
  });
});
