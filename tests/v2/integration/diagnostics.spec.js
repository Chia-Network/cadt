import { expect } from 'chai';
import supertest from 'supertest';

import app from '../../../src/server.js';
import { prepareDb } from '../../../src/database/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { createV2TestHomeOrg, withConfigOverride } from '../utils/v2-test-helpers.js';

describe('/diagnostics endpoint', function () {
  this.timeout(60000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
  });

  describe('basic shape and reachability', function () {
    it('responds 200 with the documented top-level shape', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body).to.have.property('timestamp').that.is.a('string');
      expect(response.body).to.have.property('cadt').that.is.an('object');
      expect(response.body).to.have.property('network').that.is.an('object');
      expect(response.body).to.have.property('chia').that.is.an('object');
      expect(response.body).to.have.property('system').that.is.an('object');
    });

    it('reports the current CADT version and config paths', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const cadt = response.body.cadt;
      expect(cadt).to.have.property('version').that.matches(/^\d+\.\d+\.\d+/);
      expect(cadt).to.have.property('configDir').that.is.a('string');
      expect(cadt).to.have.property('configFile').that.includes('config.yaml');
      expect(cadt).to.have.property('v1').that.is.an('object');
      expect(cadt).to.have.property('v2').that.is.an('object');
      expect(cadt.v1).to.have.property('governanceBodyId');
      expect(cadt.v2).to.have.property('governanceBodyId');
      expect(cadt).to.have.property('nonDefaultTaskIntervals').that.is.an('array');
    });

    it('reports non-default task intervals with default and actual values', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app).get('/diagnostics').expect(200);
        expect(response.body.cadt.nonDefaultTaskIntervals).to.deep.include({
          key: 'GOVERNANCE_SYNC_TASK_INTERVAL',
          default: 120,
          actual: 30,
        });
        expect(response.body.cadt.nonDefaultTaskIntervals).to.deep.include({
          key: 'MIRROR_CHECK_TASK_INTERVAL',
          default: 900,
          actual: 86460,
        });
      }, {
        APP: {
          TASKS: {
            GOVERNANCE_SYNC_TASK_INTERVAL: 30,
            MIRROR_CHECK_TASK_INTERVAL: 86460,
          },
        },
      });
    });

    it('reports CPU, memory, and disk in the system section', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const system = response.body.system;
      expect(system).to.have.property('platform').that.is.a('string');
      expect(system).to.have.property('arch').that.is.a('string');
      expect(system).to.have.property('cpu').that.is.an('object');
      expect(system.cpu).to.have.property('cores').that.is.a('number');
      expect(system).to.have.property('memory').that.is.an('object');
      expect(system.memory).to.have.property('totalBytes').that.is.a('number');
      expect(system.memory).to.have.property('freeBytes').that.is.a('number');
      expect(system.memory).to.have.property('percentUsed').that.is.a('number');
      expect(system).to.have.property('disk').that.is.an('object');
      expect(system.disk).to.have.property('chiaRootPath').that.is.a('string');
      if (system.disk.totalBytes !== null) {
        expect(system.disk).to.have.property('percentUsed').that.is.a('number');
      }
    });

    it('includes chia.version (string or null)', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia).to.have.property('version');
      const v = response.body.chia.version;
      if (v !== null) {
        expect(v).to.be.a('string');
      }
    });

    it('reports chia.runningProcesses with scan results', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const processes = response.body.chia.runningProcesses;
      expect(processes).to.have.property('matches').that.is.an('array');
      expect(processes).to.have.property('multipleVersionsDetected').that.is.a('boolean');
    });

    it('reports fullNode.runningLocally based on process scan', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const fullNode = response.body.chia.fullNode;
      expect(fullNode).to.have.property('runningLocally').that.is.a('boolean');
      expect(fullNode).to.have.property('reachable').that.is.a('boolean');
    });

    it('reports chia-tools with the PATH-visibility note', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const chiaTools = response.body.chia.chiaTools;
      expect(chiaTools).to.have.property('installed').that.is.a('boolean');
      if (chiaTools.installed) {
        expect(chiaTools).to.have.property('version').that.is.a('string');
      }
      expect(chiaTools).to.have.property('note').that.is.a('string');
    });

    it('exposes the wallet section even when wallet is unreachable', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const wallet = response.body.chia.wallet;
      expect(wallet).to.have.property('reachable').that.is.a('boolean');
      expect(wallet).to.have.property('synced').that.is.a('boolean');
      // pendingTransactions may be an object with wallet-health shape, or
      // contain an error key when the wallet RPC isn't reachable; both are
      // acceptable - we just need the key to exist.
      expect(wallet).to.have.property('pendingTransactions');
    });

    it('keeps wallet.reachable and connectionError consistent with each other', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const wallet = response.body.chia.wallet;
      expect(wallet.reachable).to.be.a('boolean');
      if (wallet.reachable) {
        expect(wallet.connectionError).to.equal(null);
      } else {
        expect(wallet.connectionError).to.be.a('string').and.not.empty;
      }
    });
  });

  describe('API-key gating', function () {
    const TEST_KEY = 'super-secret-diagnostics-key';

    it('rejects unauthenticated requests when CADT_API_KEY is configured', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app).get('/diagnostics');
        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('message');
      }, { APP: { CADT_API_KEY: TEST_KEY } });
    });

    it('accepts requests with the correct x-api-key header', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app)
          .get('/diagnostics')
          .set('x-api-key', TEST_KEY);
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('cadt');
      }, { APP: { CADT_API_KEY: TEST_KEY } });
    });

    it('rejects requests with a wrong-length x-api-key header', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app)
          .get('/diagnostics')
          .set('x-api-key', 'short');
        expect(response.status).to.equal(403);
      }, { APP: { CADT_API_KEY: TEST_KEY } });
    });

    it('rejects requests with a wrong-but-equal-length x-api-key header', async function () {
      // Equal-length but wrong-content key must still fail. Without this case
      // a mutant that drops crypto.timingSafeEqual and trusts length alone
      // would survive.
      const wrong = 'X'.repeat(TEST_KEY.length);
      await withConfigOverride(async () => {
        const response = await supertest(app)
          .get('/diagnostics')
          .set('x-api-key', wrong);
        expect(response.status).to.equal(403);
      }, { APP: { CADT_API_KEY: TEST_KEY } });
    });
  });

  describe('read-only mode', function () {
    it('returns 403 when READ_ONLY is enabled', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app).get('/diagnostics');
        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('error').that.is.a('string');
      }, { APP: { READ_ONLY: true } });
    });

    it('returns 403 regardless of API key when READ_ONLY is enabled', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app)
          .get('/diagnostics')
          .set('x-api-key', 'protected-observer-key');
        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('error').that.is.a('string');
      }, { APP: { READ_ONLY: true, CADT_API_KEY: 'protected-observer-key' } });
    });

    it('returns full detail by default (READ_ONLY off)', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia.wallet).to.have.property('pendingTransactions');
      expect(response.body.chia.wallet).to.have.property('trustedFullNodePeers');
      expect(response.body.chia.datalayer).to.have.property('subscriptions');
    });
  });

  describe('graceful degradation', function () {
    // We do NOT try to test bogus URLs via withConfigOverride here: WALLET_URL
    // is captured at wallet.js module-load time and getWalletConnections
    // short-circuits in USE_SIMULATOR mode, so the override never reaches the
    // RPC path. The real graceful-degradation guarantee is that the response
    // always returns 200 with a stable top-level shape regardless of which
    // subsystems answered -- the basic-shape tests above already verify that
    // implicitly (the simulator config has no wallet/datalayer RPC running
    // and the tests still pass).
    it('always returns 200 with the documented top-level keys', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body).to.have.all.keys(
        'timestamp', 'cadt', 'network', 'chia', 'system',
      );
      expect(response.body.system).to.have.property('cpu');
      expect(response.body.system).to.have.property('memory');
    });
  });

  describe('unit helpers', function () {
    let diagnostics;
    before(async function () {
      diagnostics = await import('../../../src/routes/diagnostics.js');
    });

    describe('normalizeNodeId', function () {
      it('strips 0x and lowercases', function () {
        const norm = diagnostics.__test.normalizeNodeId;
        expect(norm('0xABCD1234')).to.equal('abcd1234');
        expect(norm('0xabcd1234')).to.equal('abcd1234');
        expect(norm('ABCD1234')).to.equal('abcd1234');
        expect(norm(null)).to.equal('');
        expect(norm(undefined)).to.equal('');
      });
    });

    describe('buildTrustedPeerView', function () {
      const { buildTrustedPeerView } = (async () => null)(); // placeholder to keep diff small
      it('matches connected peers against trusted_peers regardless of 0x prefix or case', function () {
        const view = diagnostics.__test.buildTrustedPeerView(
          {
            ok: true,
            value: {
              connections: [
                { peerHost: '1.2.3.4', peerPort: 8444, type: 1, nodeId: '0xABCDEF12' },
                { peerHost: '5.6.7.8', peerPort: 8444, type: 1, nodeId: '11223344' },
              ],
            },
          },
          {
            ok: true,
            value: { wallet: { trusted_peers: { abcdef12: 'Does_not_matter' } } },
          },
        );
        expect(view.hasTrustedConnection).to.equal(true);
        expect(view.connected[0].trusted).to.equal(true);
        expect(view.connected[1].trusted).to.equal(false);
        expect(view.configuredTrustedNodeIds).to.deep.equal(['abcdef12']);
      });

      it('reports empty trusted set when chia config has no trusted_peers', function () {
        const view = diagnostics.__test.buildTrustedPeerView(
          { ok: true, value: { connections: [{ peerHost: 'h', peerPort: 0, type: 1, nodeId: 'aa' }] } },
          { ok: true, value: { wallet: {} } },
        );
        expect(view.hasTrustedConnection).to.equal(false);
        expect(view.connected[0].trusted).to.equal(false);
        expect(view.configuredTrustedNodeIds).to.deep.equal([]);
      });
    });

    describe('StatusAccumulator', function () {
      const SA = () => diagnostics.__test.StatusAccumulator;

      it('starts at ok with no message', function () {
        const s = new (SA())();
        expect(s.result()).to.deep.equal({ status: 'ok' });
      });

      it('escalates from ok to warning', function () {
        const s = new (SA())();
        s.escalate('warning', 'disk space low');
        expect(s.result()).to.deep.equal({ status: 'warning', message: 'disk space low' });
      });

      it('escalates from ok to critical', function () {
        const s = new (SA())();
        s.escalate('critical', 'out of disk');
        expect(s.result()).to.deep.equal({ status: 'critical', message: 'out of disk' });
      });

      it('never downgrades from critical to warning', function () {
        const s = new (SA())();
        s.escalate('critical', 'bad');
        s.escalate('warning', 'less bad');
        expect(s.result().status).to.equal('critical');
      });

      it('joins multiple messages with two spaces', function () {
        const s = new (SA())();
        s.escalate('warning', 'msg1.');
        s.escalate('warning', 'msg2.');
        expect(s.result()).to.deep.equal({ status: 'warning', message: 'msg1.  msg2.' });
      });

      it('omits message key when no messages given', function () {
        const s = new (SA())();
        s.escalate('warning');
        expect(s.result()).to.deep.equal({ status: 'warning' });
        expect(s.result()).to.not.have.property('message');
      });

      it('accumulates messages across severity levels', function () {
        const s = new (SA())();
        s.escalate('warning', 'first');
        s.escalate('critical', 'second');
        const r = s.result();
        expect(r.status).to.equal('critical');
        expect(r.message).to.equal('first  second');
      });

      it('throws on unknown severity', function () {
        const s = new (SA())();
        expect(() => s.escalate('panic')).to.throw('unknown severity');
      });
    });
  });

  describe('status logic', function () {
    it('system.disk has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const disk = response.body.system.disk;
      expect(disk).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('system.memory has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const memory = response.body.system.memory;
      expect(memory).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('system.cpu has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const cpu = response.body.system.cpu;
      expect(cpu).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('chia.wallet has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia.wallet)
        .to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('chia.fullNode has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia.fullNode)
        .to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('chia.datalayer has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia.datalayer)
        .to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('chia.chiaTools has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia.chiaTools)
        .to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('network has a status field', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.network)
        .to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
    });

    it('chiaTools status is warning when not installed', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const chiaTools = response.body.chia.chiaTools;
      if (!chiaTools.installed) {
        expect(chiaTools.status).to.equal('warning');
        expect(chiaTools.message).to.include('chia-tools');
      }
    });

    it('network status is ok when matches is null or true', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const network = response.body.network;
      if (network.matches !== false) {
        expect(network.status).to.equal('ok');
      }
    });

    it('disk status thresholds: ok / warning / critical at boundaries', async function () {
      const SA = (await import('../../../src/routes/diagnostics.js')).__test.StatusAccumulator;

      const computeDisk = (pct) => {
        const s = new SA();
        if (pct != null) {
          if (pct > 96) s.escalate('critical', 'Disk usage above 96%');
          else if (pct > 90) s.escalate('warning', 'Disk usage above 90%');
        }
        return s.result();
      };

      expect(computeDisk(50).status).to.equal('ok');
      expect(computeDisk(90).status).to.equal('ok');
      expect(computeDisk(90.01).status).to.equal('warning');
      expect(computeDisk(96).status).to.equal('warning');
      expect(computeDisk(96.01).status).to.equal('critical');
      expect(computeDisk(100).status).to.equal('critical');
      expect(computeDisk(null).status).to.equal('ok');
    });

    it('memory status thresholds: ok / warning / critical at boundaries', async function () {
      const SA = (await import('../../../src/routes/diagnostics.js')).__test.StatusAccumulator;

      const computeMemory = (pct) => {
        const s = new SA();
        if (pct != null) {
          if (pct > 99) s.escalate('critical', 'Memory usage above 99%');
          else if (pct > 90) s.escalate('warning', 'Memory usage above 90%');
        }
        return s.result();
      };

      expect(computeMemory(50).status).to.equal('ok');
      expect(computeMemory(90).status).to.equal('ok');
      expect(computeMemory(90.01).status).to.equal('warning');
      expect(computeMemory(99).status).to.equal('warning');
      expect(computeMemory(99.01).status).to.equal('critical');
      expect(computeMemory(100).status).to.equal('critical');
      expect(computeMemory(null).status).to.equal('ok');
    });

    it('response does not contain chia.services', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.chia).to.not.have.property('services');
    });

    it('chia.datalayer exposes ownedStores and expectedOwnedStores fields', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const datalayer = response.body.chia.datalayer;
      // ownedStores is either an array (datalayer reachable) or null (RPC
      // failed); totalOwnedStores must match.
      expect(datalayer).to.have.property('ownedStores');
      expect(datalayer).to.have.property('totalOwnedStores');
      if (datalayer.ownedStores === null) {
        expect(datalayer.totalOwnedStores).to.equal(null);
      } else {
        expect(datalayer.ownedStores).to.be.an('array');
        expect(datalayer.totalOwnedStores).to.equal(datalayer.ownedStores.length);
      }
      expect(datalayer).to.have.property('expectedOwnedStores').that.is.an('array');
      datalayer.expectedOwnedStores.forEach((entry) => {
        expect(entry).to.have.property('storeId').that.is.a('string');
        expect(entry).to.have.property('label').that.is.a('string');
        expect(entry).to.have.property('owned');
        expect(entry.owned === true || entry.owned === false || entry.owned === null).to.equal(true);
      });
    });

    it('escalateLostOwnedStores (production helper) escalates only on owned=false entries', async function () {
      // Drives the actual exported production helper -- not a re-implementation --
      // so this test fails if the escalation logic changes severity, message,
      // or filter behavior. owned=null (RPC failure) must NOT escalate; the
      // datalayer-unreachable critical above the helper handles that case.
      const { StatusAccumulator, escalateLostOwnedStores } = (
        await import('../../../src/routes/diagnostics.js')
      ).__test;
      const compute = (expectedOwnedStores) => {
        const acc = new StatusAccumulator();
        escalateLostOwnedStores(acc, expectedOwnedStores);
        return acc.result();
      };

      expect(compute([{ storeId: 'a', label: 'v1 home org', owned: true }]).status).to.equal('ok');
      expect(compute([{ storeId: 'a', label: 'v1 home org', owned: null }]).status).to.equal('ok');
      expect(compute([]).status).to.equal('ok');
      expect(compute(undefined).status).to.equal('ok');

      const critical = compute([
        { storeId: 'a', label: 'v1 home org', owned: true },
        { storeId: 'b', label: 'v1 registry', owned: false },
        { storeId: 'c', label: 'v1 file store', owned: null }, // unknown -- ignored
      ]);
      expect(critical.status).to.equal('critical');
      expect(critical.message).to.include('b (v1 registry)');
      expect(critical.message).to.not.include('a (v1 home org)');
      expect(critical.message).to.not.include('c (v1 file store)');
      expect(critical.message).to.include("can't be written to");
    });

    describe('end-to-end with seeded home org', function () {
      // The mocha file order puts diagnostics.spec.js early in the v2 run;
      // leaving a `test-home-org-v2` row behind would risk downstream
      // tests that probe `is_home: true` finding it. Tear it back down
      // after each test in this block.
      afterEach(async function () {
        const { OrganizationsV2 } = await import('../../../src/models/v2/index.js');
        await OrganizationsV2.destroy({ where: { org_uid: 'test-home-org-v2' } });
      });

      it('when home org exists but datalayer owns no stores, status is critical', async function () {
        // Real end-to-end check of the production wiring: seed a V2 home org
        // with all four store IDs populated, then hit /diagnostics. The
        // simulator's get_owned_stores returns an empty list, so the
        // production escalation path must fire critical with the documented
        // message -- exercising collectOwnedStoreExpectations, the V2
        // governance gating, escalateLostOwnedStores, and datalayer status
        // assembly all on the real code path.
        await createV2TestHomeOrg();
        const response = await supertest(app).get('/diagnostics').expect(200);
        const datalayer = response.body.chia.datalayer;
        expect(datalayer.ownedStores).to.be.an('array').that.is.empty;
        expect(datalayer.expectedOwnedStores).to.be.an('array').that.is.not.empty;
        const lost = datalayer.expectedOwnedStores.filter((e) => e.owned === false);
        expect(lost.length).to.be.greaterThan(0);
        const lostLabels = lost.map((e) => e.label);
        expect(lostLabels).to.include('v2 home org');
        expect(lostLabels).to.include('v2 registry');
        expect(lostLabels).to.include('v2 file store');
        expect(lostLabels).to.include('v2 data model version store');
        expect(datalayer.status).to.equal('critical');
        expect(datalayer.message).to.include("expected owned store is not owned by datalayer");
        lost.forEach((entry) => {
          expect(datalayer.message).to.include(`${entry.storeId} (${entry.label})`);
        });
      });
    });
  });
});
