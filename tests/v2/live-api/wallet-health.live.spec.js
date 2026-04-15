import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { getLiveApiRequest, getLiveApiConfig } from './helpers/live-api-helpers.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';
import wallet from '../../../src/datalayer/wallet.js';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const getWalletRpcUrl = () => {
  const { config } = getLiveApiConfig();
  return config?.APP?.WALLET_URL || 'https://localhost:9256';
};

const getWalletBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certPath = path.resolve(`${chiaRoot}/config/ssl/wallet/private_wallet.crt`);
  const keyPath = path.resolve(`${chiaRoot}/config/ssl/wallet/private_wallet.key`);
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
      // Try v2 first, fall back to v1
      let res = await request.get('/v2/health/wallet');
      if (res.status === 404) {
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
