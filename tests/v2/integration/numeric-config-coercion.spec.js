import { expect } from 'chai';
import _ from 'lodash';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import * as yaml from 'js-yaml';

import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';
import { defaultConfig } from '../../../src/utils/defaultConfig.js';
import {
  NUMERIC_APP_CONFIG_PATHS,
  coerceConfigNumber,
  coerceNumericAppConfig,
} from '../../../src/utils/numeric-config.js';

/**
 * Numeric APP config values must reach the JS layer as numbers.
 *
 * YAML keeps quoted values as strings, so `DEFAULT_COIN_AMOUNT + DEFAULT_FEE`
 * concatenated "300" and "300" into "300300" instead of adding to 600, and the
 * wallet then waited for coins of 300300+ mojos before creating an org.
 */
describe('Numeric config coercion', function () {
  const silentLog = { warn: () => {} };

  describe('coerceConfigNumber', function () {
    it('passes finite numbers through unchanged', function () {
      expect(coerceConfigNumber(300, 3000, 'APP.DEFAULT_FEE')).to.equal(300);
      expect(coerceConfigNumber(0, 3000, 'APP.DEFAULT_FEE')).to.equal(0);
    });

    it('parses numeric strings, including padded ones', function () {
      expect(coerceConfigNumber('300', 3000, 'APP.DEFAULT_FEE')).to.equal(300);
      expect(coerceConfigNumber(' 300 ', 3000, 'APP.DEFAULT_FEE')).to.equal(
        300,
      );
    });

    it('falls back to the default for missing values without warning', function () {
      const warnings = [];
      const log = { warn: (msg) => warnings.push(msg) };

      expect(
        coerceConfigNumber(undefined, 3000, 'APP.DEFAULT_FEE', log),
      ).to.equal(3000);
      expect(coerceConfigNumber(null, 3000, 'APP.DEFAULT_FEE', log)).to.equal(
        3000,
      );
      expect(warnings).to.deep.equal([]);
    });

    it('falls back to the default for non-numeric values and warns', function () {
      const warnings = [];
      const log = { warn: (msg) => warnings.push(msg) };

      for (const garbage of [
        '',
        'abc',
        '300 mojos',
        '0x12',
        true,
        false,
        [],
        {},
        NaN,
        Infinity,
      ]) {
        expect(
          coerceConfigNumber(garbage, 3000, 'APP.DEFAULT_FEE', log),
        ).to.equal(3000);
      }
      // '' is a value, not an absence, so it warns like the rest.
      expect(warnings).to.have.lengthOf(10);
    });

    it('never returns NaN, which would make every >= comparison false', function () {
      for (const garbage of ['abc', true, {}, NaN]) {
        expect(
          Number.isNaN(
            coerceConfigNumber(garbage, 3000, 'APP.DEFAULT_FEE', silentLog),
          ),
        ).to.be.false;
      }
    });
  });

  describe('coerceNumericAppConfig', function () {
    it('coerces every documented numeric key', function () {
      const stringified = {};
      for (const configPath of NUMERIC_APP_CONFIG_PATHS) {
        _.set(
          stringified,
          configPath,
          String(_.get(defaultConfig.APP, configPath)),
        );
      }

      const coerced = coerceNumericAppConfig(stringified, silentLog);

      for (const configPath of NUMERIC_APP_CONFIG_PATHS) {
        expect(_.get(coerced, configPath), configPath).to.equal(
          _.get(defaultConfig.APP, configPath),
        );
      }
    });

    it('leaves non-numeric keys untouched', function () {
      const coerced = coerceNumericAppConfig(
        {
          LOG_LEVEL: 'debug',
          CHIA_NETWORK: 'testnet',
          CERTIFICATE_FOLDER_PATH: null,
        },
        silentLog,
      );

      expect(coerced.LOG_LEVEL).to.equal('debug');
      expect(coerced.CHIA_NETWORK).to.equal('testnet');
      expect(coerced.CERTIFICATE_FOLDER_PATH).to.be.null;
    });

    it('does not mutate the input or defaultConfig', function () {
      const input = {
        DEFAULT_FEE: '300',
        TASKS: { PICKLIST_SYNC_TASK_INTERVAL: '60' },
      };

      coerceNumericAppConfig(input, silentLog);

      expect(input.DEFAULT_FEE).to.equal('300');
      expect(input.TASKS.PICKLIST_SYNC_TASK_INTERVAL).to.equal('60');
      expect(defaultConfig.APP.DEFAULT_FEE).to.equal(3000);
      expect(defaultConfig.APP.TASKS.PICKLIST_SYNC_TASK_INTERVAL).to.equal(120);
    });

    it('leaves TRUST_PROXY to resolveTrustProxyHops', function () {
      const coerced = coerceNumericAppConfig({ TRUST_PROXY: true }, silentLog);
      expect(coerced.TRUST_PROXY).to.equal(true);
    });
  });

  describe('config-loader with quoted YAML values', function () {
    let testChiaRoot;
    let configFile;
    let savedCwPort;

    const clearConfigCaches = () => {
      getChiaRoot.cache?.clear();
      getConfig.cache?.clear();
      getConfigV2.cache?.clear();
    };

    const writeConfig = (app) => {
      fs.writeFileSync(
        configFile,
        yaml.dump({ APP: app, V1: { ENABLE: true }, V2: { ENABLE: true } }),
        'utf8',
      );
      clearConfigCaches();
    };

    beforeEach(function () {
      testChiaRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'cadt-numeric-config-'),
      );
      fs.mkdirSync(path.join(testChiaRoot, 'cadt'), { recursive: true });
      configFile = path.join(testChiaRoot, 'cadt', 'config.yaml');

      savedCwPort = process.env.CW_PORT;
      delete process.env.CW_PORT;
      process.env.CHIA_ROOT = testChiaRoot;
      clearConfigCaches();
    });

    afterEach(function () {
      fs.rmSync(testChiaRoot, { recursive: true, force: true });
      delete process.env.CHIA_ROOT;
      if (savedCwPort !== undefined) {
        process.env.CW_PORT = savedCwPort;
      }
      clearConfigCaches();
    });

    it('turns DEFAULT_FEE: "300" and DEFAULT_COIN_AMOUNT: "300" into 600, not 300300', function () {
      writeConfig({ DEFAULT_FEE: '300', DEFAULT_COIN_AMOUNT: '300' });

      const app = getConfig().APP;

      expect(app.DEFAULT_FEE).to.equal(300);
      expect(app.DEFAULT_COIN_AMOUNT).to.equal(300);
      // The expression from wallet.js and coin-management.js.
      expect(app.DEFAULT_COIN_AMOUNT + app.DEFAULT_FEE).to.equal(600);
    });

    it('resolves stock defaults quoted as strings to 3300 and a 1,000,000 COIN_SIZE', function () {
      writeConfig({ DEFAULT_FEE: '3000', DEFAULT_COIN_AMOUNT: '300' });

      const app = getConfig().APP;
      const DUST_FILTER_FLOOR = 1_000_000;
      const minUsableCoinSize = app.DEFAULT_COIN_AMOUNT + app.DEFAULT_FEE;

      expect(minUsableCoinSize).to.equal(3300);
      expect(Math.max(minUsableCoinSize, DUST_FILTER_FLOOR)).to.equal(
        1_000_000,
      );
    });

    it('applies the same coercion to the V2 config', function () {
      writeConfig({ DEFAULT_FEE: '300', DEFAULT_COIN_AMOUNT: '300' });

      const app = getConfigV2().APP;

      expect(app.DEFAULT_COIN_AMOUNT + app.DEFAULT_FEE).to.equal(600);
    });

    it('gives the Chia RPC numbers for fee and amount_per_coin', function () {
      writeConfig({ DEFAULT_FEE: '300', DEFAULT_COIN_AMOUNT: '300' });

      const app = getConfig().APP;

      // The accessors used in src/datalayer/persistance.js.
      expect(_.get(app, 'DEFAULT_FEE', 3000)).to.be.a('number');
      expect(_.get(app, 'DEFAULT_COIN_AMOUNT', 300)).to.be.a('number');
      expect(app.DEFAULT_FEE).to.be.a('number');
    });

    it('coerces quoted task intervals and request content limits', function () {
      writeConfig({
        TASKS: { COIN_MANAGEMENT_TASK_INTERVAL: '3600' },
        REQUEST_CONTENT_LIMITS: { STAGING: { EDIT_DATA_LEN: '50' } },
      });

      const app = getConfig().APP;

      expect(app.TASKS.COIN_MANAGEMENT_TASK_INTERVAL).to.equal(3600);
      expect(app.REQUEST_CONTENT_LIMITS.STAGING.EDIT_DATA_LEN).to.equal(50);
    });

    it('falls back to documented defaults for unparseable values', function () {
      writeConfig({ DEFAULT_FEE: 'not-a-number', DEFAULT_COIN_AMOUNT: '' });

      const app = getConfig().APP;

      expect(app.DEFAULT_FEE).to.equal(3000);
      expect(app.DEFAULT_COIN_AMOUNT).to.equal(300);
      expect(app.DEFAULT_COIN_AMOUNT + app.DEFAULT_FEE).to.equal(3300);
    });
  });

  describe('docker-entrypoint.sh', function () {
    const repoRoot = path.resolve(process.cwd());
    const scriptPath = path.join(
      repoRoot,
      'tests/shell/docker-entrypoint-numeric-config.sh',
    );

    it('routes every numeric APP key through the numeric writer', function () {
      const entrypoint = fs.readFileSync(
        path.join(repoRoot, 'docker-entrypoint.sh'),
        'utf8',
      );
      // TRUST_PROXY is not in NUMERIC_APP_CONFIG_PATHS (resolveTrustProxyHops
      // coerces it) but still belongs in config.yaml as a number.
      const numericPaths = [...NUMERIC_APP_CONFIG_PATHS, 'TRUST_PROXY'];

      for (const configPath of numericPaths) {
        const callSite = entrypoint
          .split('\n')
          .find((line) => line.includes(`'.${configPath}'`));

        expect(
          callSite,
          `no docker-entrypoint.sh call site for APP.${configPath}`,
        ).to.exist;
        expect(callSite, `APP.${configPath}`).to.match(
          /^update_numeric_app_config /,
        );
      }
    });

    describe('config.yaml it writes', function () {
      let written;

      before(function () {
        // yq v4 ships in the Docker image but is not a dev dependency.
        if (spawnSync('yq', ['--version']).error) {
          this.skip();
        }
        written = yaml.load(
          execFileSync('bash', [scriptPath], {
            cwd: repoRoot,
            encoding: 'utf8',
          }),
        );
      });

      it('writes integer env vars as YAML numbers', function () {
        expect(written.APP.DEFAULT_FEE).to.equal(300);
        expect(written.APP.DEFAULT_COIN_AMOUNT).to.equal(300);
      });

      it('keeps digit-only values on non-numeric keys as strings', function () {
        expect(written.V1.CADT_API_KEY).to.equal('12345678');
        expect(written.V1.GOVERNANCE.GOVERNANCE_BODY_ID).to.equal('99999999');
      });

      it('leaves boolean, string and empty handling unchanged', function () {
        expect(written.APP.USE_SIMULATOR).to.equal(true);
        expect(written.APP.CHIA_NETWORK).to.equal('testnet');
        expect(written.APP.CERTIFICATE_FOLDER_PATH).to.be.null;
      });
    });
  });
});
