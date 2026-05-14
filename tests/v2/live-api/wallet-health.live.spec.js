import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import {
  getLiveApiRequest,
  getLiveApiConfig,
  getChiaCertificateFolderPath,
} from './helpers/live-api-helpers.js';
import wallet from '../../../src/datalayer/wallet.js';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const getWalletRpcUrl = () => {
  const { config } = getLiveApiConfig();
  return config?.APP?.WALLET_URL || 'https://localhost:9256';
};

const getWalletBaseOptions = () => {
  // Resolve via getChiaCertificateFolderPath so this test honours
  // CERTIFICATE_FOLDER_PATH the same way src/datalayer/wallet.js does.
  // Hardcoding ${chiaRoot}/config/ssl here would cause a false-negative
  // test failure in any deployment that uses a non-default Chia SSL
  // directory, even though production code would successfully reach
  // the wallet RPC.
  const certificateFolderPath = getChiaCertificateFolderPath();
  const certPath = path.resolve(
    `${certificateFolderPath}/wallet/private_wallet.crt`,
  );
  const keyPath = path.resolve(
    `${certificateFolderPath}/wallet/private_wallet.key`,
  );
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    timeout: 30000,
  };
};

describe('Wallet Health - Live', function () {
  this.timeout(60000);

  let request;

  before(async function () {
    request = await getLiveApiRequest({ apiVersion: 'any' });
  });

  describe('CADT /health/wallet endpoint', function () {
    it('should report DataLayer wallet as available', async function () {
      // Try v2 first, fall back to v1 (v2 returns 403 or 404 when disabled)
      let res = await request.get('/v2/health/wallet');
      if (res.status === 403 || res.status === 404) {
        res = await request.get('/v1/health/wallet');
      }
      expect(res.status).to.equal(200);

      if (res.body.readOnly) {
        this.skip();
        return;
      }

      expect(res.body.dataLayerWallet, 'dataLayerWallet missing from response').to.exist;
      expect(
        res.body.dataLayerWallet.available,
        'CADT failed to discover the DataLayer wallet. ' +
        'This likely means the WalletType constant in getDLWalletId() ' +
        'does not match chia-blockchain\'s WalletType.DATA_LAYER enum.',
      ).to.equal(true);
      expect(res.body.dataLayerWallet.walletId).to.be.a('number').and.to.be.greaterThan(0);
    });
  });

  describe('CADT /diagnostics endpoint', function () {
    // Smoke-test the system-wide diagnostics endpoint against a real CADT +
    // Chia install. We deliberately assert TYPES and RANGES rather than
    // specific values: CI machines vary in CPU/RAM/disk size, network may be
    // mainnet/testnet, the local wallet may or may not be synced, etc. The
    // intent is to catch the response failing to serialize or the shape
    // regressing, not to pin the operator's environment.
    it('returns a well-shaped response with sensible types and ranges', async function () {
      const res = await request.get('/diagnostics');
      expect(res.status).to.equal(200);

      const body = res.body;
      // Log the full response so it's easy to inspect what /diagnostics
      // actually reports against this CI environment. This runs as a
      // preflight in 5 different live-api workflows, so the body is the
      // best single artifact for eyeballing the endpoint's real output.
      console.log('  ----- /diagnostics response -----');
      console.log(JSON.stringify(body, null, 2)
        .split('\n').map((l) => '  ' + l).join('\n'));
      console.log('  ----- end /diagnostics response -----');

      // Top-level shape -----------------------------------------------------
      expect(body.timestamp, 'timestamp must be ISO-8601').to.match(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(body.cadt).to.be.an('object');
      expect(body.network).to.be.an('object');
      expect(body.chia).to.be.an('object');
      expect(body.system).to.be.an('object');

      // CADT section --------------------------------------------------------
      expect(body.cadt.version, 'CADT version must look like semver').to.match(
        /^\d+\.\d+\.\d+/,
      );
      expect(body.cadt.configDir).to.be.a('string').and.not.empty;
      expect(body.cadt.configFile).to.be.a('string').that.includes('config.yaml');
      expect(body.cadt.v1, 'cadt.v1 section').to.be.an('object');
      expect(body.cadt.v2, 'cadt.v2 section').to.be.an('object');
      expect(body.cadt.v1.enabled).to.be.a('boolean');
      expect(body.cadt.v2.enabled).to.be.a('boolean');

      // System section ------------------------------------------------------
      expect(body.system.platform).to.be.a('string').and.not.empty;
      expect(body.system.arch).to.be.a('string').and.not.empty;
      expect(body.system.cpu).to.be.an('object');
      expect(body.system.cpu.cores, 'CPU cores must be a positive integer')
        .to.be.a('number').and.to.be.at.least(1);
      if (body.system.cpu.model !== null) {
        expect(body.system.cpu.model).to.be.a('string').and.not.empty;
      }
      expect(body.system.memory.totalBytes).to.be.a('number').and.to.be.greaterThan(0);
      expect(body.system.memory.freeBytes).to.be.a('number').and.to.be.at.least(0);
      expect(body.system.memory.percentUsed).to.be.a('number').and.to.be.at.least(0).and.at.most(100);
      expect(
        body.system.memory.freeBytes,
        'freeBytes cannot exceed totalBytes',
      ).to.be.at.most(body.system.memory.totalBytes);
      expect(body.system.disk).to.be.an('object');
      expect(body.system.disk.chiaRootPath).to.be.a('string').and.not.empty;
      if (body.system.disk.totalBytes !== null) {
        expect(body.system.disk.totalBytes).to.be.a('number').and.to.be.greaterThan(0);
        expect(body.system.disk.freeBytes).to.be.at.most(body.system.disk.totalBytes);
        expect(body.system.disk.percentUsed).to.be.a('number').and.to.be.at.least(0).and.at.most(100);
      }

      // Chia: version -------------------------------------------------------
      expect(body.chia).to.have.property('version');
      if (body.chia.version !== null) {
        expect(body.chia.version).to.be.a('string');
      }

      // Status fields -------------------------------------------------------
      expect(body.system.disk).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.system.memory).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.system.cpu).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.chia.wallet).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.chia.fullNode).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.chia.datalayer).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.chia.chiaTools).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);
      expect(body.network).to.have.property('status').that.is.oneOf(['ok', 'warning', 'critical']);

      // Network section (top-level) -----------------------------------------
      expect(body.network).to.be.an('object');
      if (body.network.cadt !== null) {
        expect(body.network.cadt).to.be.a('string').and.not.empty;
      }

      // Chia: wallet (reachable ↔ connectionError consistency) -------------
      expect(body.chia.wallet).to.be.an('object');
      expect(body.chia.wallet.reachable).to.be.a('boolean');
      expect(body.chia.wallet.synced).to.be.a('boolean');
      if (body.chia.wallet.reachable) {
        expect(
          body.chia.wallet.connectionError,
          'reachable wallet must not carry a connection error',
        ).to.equal(null);
      } else {
        expect(
          body.chia.wallet.connectionError,
          'unreachable wallet must carry a connection error message',
        ).to.be.a('string').and.not.empty;
      }
      // Chia: full node + datalayer (just shape, not state) ----------------
      expect(body.chia.fullNode).to.be.an('object');
      expect(body.chia.fullNode).to.have.property('runningLocally').that.is.a('boolean');
      expect(body.chia.fullNode.reachable).to.be.a('boolean');
      expect(body.chia.datalayer).to.be.an('object');
      expect(body.chia.datalayer.reachable).to.be.a('boolean');

      // Chia: process scan + chia-tools probe ------------------------------
      expect(body.chia.runningProcesses).to.be.an('object');
      expect(body.chia.runningProcesses.matches).to.be.an('array');
      expect(body.chia.chiaTools).to.be.an('object');
      expect(body.chia.chiaTools.installed).to.be.a('boolean');
      expect(body.chia.chiaTools.note).to.be.a('string').and.not.empty;
    });

  });

  describe('Chia wallet RPC get_wallets', function () {
    it('should contain a DATA_LAYER wallet matching CADT constant', async function () {
      const rpcUrl = getWalletRpcUrl();
      const { cert, key, timeout } = getWalletBaseOptions();

      let data;
      try {
        const response = await superagent
          .post(`${rpcUrl}/get_wallets`)
          .send({})
          .key(key)
          .cert(cert)
          .timeout(timeout);
        data = response.body || JSON.parse(response.text);
      } catch (error) {
        console.log(`  Wallet RPC at ${rpcUrl} unreachable: ${error.message}`);
        this.skip();
        return;
      }

      expect(data.success, 'get_wallets RPC failed').to.be.true;

      const dlWallet = data.wallets.find(
        (w) => w.type === wallet.CHIA_WALLET_TYPE_DATA_LAYER,
      );
      expect(
        dlWallet,
        `No wallet with type=${wallet.CHIA_WALLET_TYPE_DATA_LAYER} (DATA_LAYER) ` +
        `found in get_wallets response. Types present: ` +
        `[${data.wallets.map((w) => `${w.type} (${w.name})`).join(', ')}]. ` +
        `If chia-blockchain changed the WalletType enum, update ` +
        `CHIA_WALLET_TYPE_DATA_LAYER in src/datalayer/wallet.js.`,
      ).to.exist;

      const parsedId = wallet.findDLWalletInResponse(data);
      expect(parsedId, 'findDLWalletInResponse should return the DL wallet id').to.equal(
        String(dlWallet.id),
      );
    });
  });
});
