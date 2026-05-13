import { expect } from 'chai';
import supertest from 'supertest';

import app from '../../../src/server.js';
import { prepareDb } from '../../../src/database/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { withConfigOverride } from '../utils/v2-test-helpers.js';

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
      expect(response.body).to.have.property('readOnly');
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

    it('reports chia.services flags', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      const services = response.body.chia.services;
      expect(services).to.have.property('walletReachable').that.is.a('boolean');
      expect(services).to.have.property('fullNodeReachable').that.is.a('boolean');
      expect(services).to.have.property('datalayerReachable').that.is.a('boolean');
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
      expect(response.body.chia.services.walletReachable).to.equal(wallet.reachable);
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

  describe('read-only stripping', function () {
    // The exact contract is documented in src/routes/diagnostics.js and
    // mirrors the wallet-health.js convention: when READ_ONLY is true the
    // response retains only non-sensitive metadata. Balances, transaction
    // details, peer details, subscription IDs, and home-org IDs MUST be
    // absent. We also intentionally short-circuit BEFORE the wallet/datalayer
    // RPC fan-out, so the entire `chia.wallet` and `chia.datalayer` sections
    // are omitted in read-only mode.
    it('omits operational details when READ_ONLY is enabled', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app).get('/diagnostics').expect(200);
        expect(response.body).to.have.property('readOnly', true);
        expect(response.body).to.have.property('message').that.is.a('string');

        expect(response.body.chia).to.not.have.property('wallet');
        expect(response.body.chia).to.not.have.property('datalayer');
        expect(response.body.chia).to.not.have.property('fullNode');
        expect(response.body.chia).to.not.have.property('services');

        expect(response.body.cadt.v1).to.not.have.property('homeOrgId');
        expect(response.body.cadt.v2).to.not.have.property('homeOrgId');

        expect(response.body.cadt).to.have.property('version');
        expect(response.body.network).to.have.property('cadt');
        expect(response.body.chia).to.have.property('chiaTools');
        expect(response.body).to.have.property('system');
      }, { APP: { READ_ONLY: true } });
    });

    it('keeps full detail by default (READ_ONLY off)', async function () {
      const response = await supertest(app).get('/diagnostics').expect(200);
      expect(response.body.readOnly).to.equal(false);
      expect(response.body.chia.wallet).to.have.property('pendingTransactions');
      expect(response.body.chia.wallet).to.have.property('trustedFullNodePeers');
      expect(response.body.chia.datalayer).to.have.property('subscriptions');
    });

    // The four scenarios below exhaustively cover the (READ_ONLY × API key
    // configured × key provided) matrix for READ_ONLY=true. They confirm both
    // (a) a public observer node with no API key gets the reduced response
    // without authentication, and (b) when an API key IS configured the
    // endpoint still enforces it, returning the reduced response only to
    // authenticated callers.
    it('public observer node (READ_ONLY=true, no API key): returns 200 with reduced fields without auth', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app).get('/diagnostics');
        expect(response.status).to.equal(200);
        expect(response.body.readOnly).to.equal(true);
        expect(response.body.chia).to.not.have.property('wallet');
        expect(response.body.chia).to.not.have.property('datalayer');
        expect(response.body.chia).to.not.have.property('fullNode');
        expect(response.body.cadt).to.have.property('version');
        expect(response.body.network).to.have.property('cadt');
        expect(response.body).to.have.property('system');
      }, { APP: { READ_ONLY: true, CADT_API_KEY: '' } });
    });

    it('READ_ONLY=true + API key configured + no key provided: rejects with 403', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app).get('/diagnostics');
        expect(response.status).to.equal(403);
      }, { APP: { READ_ONLY: true, CADT_API_KEY: 'protected-observer-key' } });
    });

    it('READ_ONLY=true + API key configured + correct key: returns 200 with reduced fields', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app)
          .get('/diagnostics')
          .set('x-api-key', 'protected-observer-key');
        expect(response.status).to.equal(200);
        expect(response.body.readOnly).to.equal(true);
        expect(response.body.chia).to.not.have.property('wallet');
        expect(response.body.chia).to.not.have.property('datalayer');
      }, { APP: { READ_ONLY: true, CADT_API_KEY: 'protected-observer-key' } });
    });

    it('READ_ONLY=true + API key configured + wrong key: rejects with 403', async function () {
      await withConfigOverride(async () => {
        const response = await supertest(app)
          .get('/diagnostics')
          .set('x-api-key', 'X'.repeat('protected-observer-key'.length));
        expect(response.status).to.equal(403);
      }, { APP: { READ_ONLY: true, CADT_API_KEY: 'protected-observer-key' } });
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
        'timestamp', 'readOnly', 'cadt', 'network', 'chia', 'system',
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
  });
});
