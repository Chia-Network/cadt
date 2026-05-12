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
