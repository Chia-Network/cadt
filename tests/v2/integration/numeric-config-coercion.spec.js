import { expect } from 'chai';
import _ from 'lodash';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import * as yaml from 'js-yaml';

import TaskManager from '../../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';
import { defaultConfig } from '../../../src/utils/defaultConfig.js';
import {
  NUMERIC_APP_CONFIG_PATHS,
  coerceConfigNumber,
  coerceNumericAppConfig,
} from '../../../src/utils/numeric-config.js';

describe('Numeric config coercion', function () {
  const silentLog = { warn: () => {} };

  describe('coerceConfigNumber', function () {
    it('passes non-negative safe integers through unchanged', function () {
      expect(coerceConfigNumber(300, 3000, 'APP.DEFAULT_FEE')).to.equal(300);
      expect(coerceConfigNumber(0, 3000, 'APP.DEFAULT_FEE')).to.equal(0);
    });

    it('parses unsigned integer strings, including padded ones', function () {
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

    it('falls back to the default for out-of-contract values and warns once each', function () {
      const warnings = [];
      const log = { warn: (msg) => warnings.push(msg) };

      const rejected = [
        // '' is a value, not an absence, so it warns like the rest.
        '',
        'abc',
        '300 mojos',
        '0x12',
        '1e3',
        true,
        false,
        [],
        {},
        NaN,
        Infinity,
        // Every key is a count of mojos, seconds, ports or items: a sign or a
        // fraction is out of contract, not a value to round or truncate.
        -5,
        '-5',
        '+3000',
        31310.5,
        '31310.5',
        // Beyond MAX_SAFE_INTEGER, Number() silently returns a different value.
        '99999999999999999999',
      ];

      rejected.forEach((value, index) => {
        expect(
          coerceConfigNumber(value, 3000, 'APP.DEFAULT_FEE', log),
          `input ${String(value)}`,
        ).to.equal(3000);
        expect(warnings, `input ${String(value)}`).to.have.lengthOf(index + 1);
      });
    });

    it('names the key and the offending value in the warning', function () {
      const warnings = [];
      const log = { warn: (msg) => warnings.push(msg) };

      coerceConfigNumber(NaN, 3000, 'APP.DEFAULT_FEE', log);
      coerceConfigNumber('abc', 300, 'APP.DEFAULT_COIN_AMOUNT', log);

      // NaN must not render as `null`, which reads as "not configured".
      expect(warnings[0]).to.include('APP.DEFAULT_FEE=NaN');
      expect(warnings[0]).to.include('falling back to 3000');
      expect(warnings[1]).to.include('APP.DEFAULT_COIN_AMOUNT="abc"');
    });
  });

  describe('NUMERIC_APP_CONFIG_PATHS', function () {
    // Spelled out rather than re-derived from defaultConfig: the production
    // list is derived, so a copy of that derivation would agree with any drift.
    // Adding a numeric APP key should fail here until it also gets a
    // docker-entrypoint.sh call site, which the suite below checks.
    it('covers exactly the numeric APP keys', function () {
      expect([...NUMERIC_APP_CONFIG_PATHS].sort()).to.deep.equal(
        [
          'CW_PORT',
          'DEFAULT_FEE',
          'DEFAULT_COIN_AMOUNT',
          'TASKS.GOVERNANCE_SYNC_TASK_INTERVAL',
          'TASKS.ORGANIZATION_META_SYNC_TASK_INTERVAL',
          'TASKS.PICKLIST_SYNC_TASK_INTERVAL',
          'TASKS.MIRROR_CHECK_TASK_INTERVAL',
          'TASKS.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL',
          'TASKS.COIN_MANAGEMENT_TASK_INTERVAL',
          'REQUEST_CONTENT_LIMITS.STAGING.EDIT_DATA_LEN',
          'REQUEST_CONTENT_LIMITS.UNITS.INCLUDE_COLUMNS_LEN',
          'REQUEST_CONTENT_LIMITS.UNITS.MARKETPLACE_IDENTIFIERS_LEN',
          'REQUEST_CONTENT_LIMITS.PROJECTS.INCLUDE_COLUMNS_LEN',
          'REQUEST_CONTENT_LIMITS.PROJECTS.PROJECT_IDS_LEN',
        ].sort(),
      );
    });

    it('excludes TRUST_PROXY, which resolveTrustProxyHops owns', function () {
      expect(defaultConfig.APP.TRUST_PROXY).to.be.a('number');
      expect(NUMERIC_APP_CONFIG_PATHS).to.not.include('TRUST_PROXY');
    });
  });

  describe('coerceNumericAppConfig', function () {
    it('coerces every numeric key', function () {
      const warnings = [];
      const log = { warn: (msg) => warnings.push(msg) };

      // Offset from the defaults so a silent fall back to defaultConfig is
      // distinguishable from an actual parse.
      const expected = {};
      const stringified = {};
      for (const configPath of NUMERIC_APP_CONFIG_PATHS) {
        const value = _.get(defaultConfig.APP, configPath) + 1;
        _.set(expected, configPath, value);
        _.set(stringified, configPath, String(value));
      }

      const coerced = coerceNumericAppConfig(stringified, log);

      for (const configPath of NUMERIC_APP_CONFIG_PATHS) {
        expect(_.get(coerced, configPath), configPath).to.equal(
          _.get(expected, configPath),
        );
      }
      expect(warnings).to.deep.equal([]);
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
    let savedChiaRoot;

    const clearConfigCaches = () => {
      getChiaRoot.cache?.clear();
      getConfig.cache?.clear();
      getConfigV2.cache?.clear();
    };

    const restoreEnv = (name, saved) => {
      if (saved === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved;
      }
    };

    const writeConfig = (app) => {
      fs.writeFileSync(
        configFile,
        yaml.dump({ APP: app, V1: { ENABLE: true }, V2: { ENABLE: true } }),
        'utf8',
      );
      clearConfigCaches();
    };

    before(function () {
      // This suite repoints CHIA_ROOT at a temp directory it later deletes and
      // clears the config memo caches. A background task waking up mid-test
      // would repopulate those caches from the synthetic config.
      TaskManager.stopAll();
    });

    beforeEach(function () {
      testChiaRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'cadt-numeric-config-'),
      );
      fs.mkdirSync(path.join(testChiaRoot, 'cadt'), { recursive: true });
      configFile = path.join(testChiaRoot, 'cadt', 'config.yaml');

      savedCwPort = process.env.CW_PORT;
      savedChiaRoot = process.env.CHIA_ROOT;
      delete process.env.CW_PORT;
      process.env.CHIA_ROOT = testChiaRoot;
      clearConfigCaches();
    });

    afterEach(function () {
      fs.rmSync(testChiaRoot, { recursive: true, force: true });
      // Both are process-global and read by every module that calls
      // getConfig(), so restore rather than delete: a test that leaves either
      // one set changes how later spec files resolve their config.
      restoreEnv('CHIA_ROOT', savedChiaRoot);
      restoreEnv('CW_PORT', savedCwPort);
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

    it('resolves stock defaults quoted as strings to a 3300 minimum usable coin size', function () {
      writeConfig({ DEFAULT_FEE: '3000', DEFAULT_COIN_AMOUNT: '300' });

      const app = getConfig().APP;

      // These happen to equal the shipped defaults, so assert the types too:
      // that is what separates coercion from the strings passing straight
      // through, which is the reported bug.
      expect(app.DEFAULT_FEE).to.be.a('number');
      expect(app.DEFAULT_COIN_AMOUNT).to.be.a('number');
      expect(app.DEFAULT_COIN_AMOUNT + app.DEFAULT_FEE).to.equal(3300);
    });

    it('applies the same coercion to the V2 config', function () {
      writeConfig({ DEFAULT_FEE: '300', DEFAULT_COIN_AMOUNT: '300' });

      const app = getConfigV2().APP;

      expect(app.DEFAULT_COIN_AMOUNT + app.DEFAULT_FEE).to.equal(600);
    });

    it('gives the Chia RPC numbers for fee and amount_per_coin', function () {
      writeConfig({ DEFAULT_FEE: '13', DEFAULT_COIN_AMOUNT: '7' });

      const app = getConfig().APP;

      // The accessors used in src/datalayer/persistance.js. Exact values, so a
      // loader that ignored the file and returned defaults would still fail.
      expect(_.get(app, 'DEFAULT_FEE', 3000)).to.equal(13);
      expect(_.get(app, 'DEFAULT_COIN_AMOUNT', 300)).to.equal(7);
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

    it('keeps the CW_PORT env override numeric', function () {
      // Distinct from defaultConfig.APP.CW_PORT so each branch is identifiable.
      writeConfig({ CW_PORT: '31315' });

      expect(getConfig().APP.CW_PORT).to.equal(31315);

      process.env.CW_PORT = '31399';
      clearConfigCaches();
      expect(getConfig().APP.CW_PORT).to.equal(31399);
    });

    it('keeps the configured port when the CW_PORT env value is unusable', function () {
      writeConfig({ CW_PORT: '31315' });

      // A fractional port reaches http.listen as ERR_SOCKET_BAD_PORT, and
      // Kubernetes injects `tcp://10.0.0.5:31310` for a Service named cw.
      for (const unusable of ['not-a-port', '31399.5', '-1']) {
        process.env.CW_PORT = unusable;
        clearConfigCaches();
        expect(getConfig().APP.CW_PORT, unusable).to.equal(31315);
      }
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
    const entrypoint = () =>
      fs.readFileSync(path.join(repoRoot, 'docker-entrypoint.sh'), 'utf8');

    it('routes every numeric APP key through the numeric writer', function () {
      for (const configPath of NUMERIC_APP_CONFIG_PATHS) {
        // Every matching line, not just the first, so a stray update_app_config
        // added later for the same key is still caught.
        const callSites = entrypoint()
          .split('\n')
          .filter((line) => line.includes(`'.${configPath}'`));

        expect(
          callSites,
          `no docker-entrypoint.sh call site for APP.${configPath}`,
        ).to.not.be.empty;
        for (const callSite of callSites) {
          expect(callSite.trim(), `APP.${configPath}`).to.match(
            /^update_numeric_app_config /,
          );
        }
      }
    });

    it('keeps an entrypoint call site for TRUST_PROXY', function () {
      // Excluded from the numeric writer because resolveTrustProxyHops owns its
      // own coercion, which leaves it outside both guards above.
      const callSites = entrypoint()
        .split('\n')
        .filter((line) => line.includes("'.TRUST_PROXY'"));

      expect(callSites).to.have.lengthOf(1);
      expect(callSites[0].trim()).to.match(/^update_app_config /);
    });

    it('routes nothing else through the numeric writer', function () {
      // The inverse guard. Sending a digit-only API key or governance body ID
      // through the numeric writer would strip its quotes and change its type
      // in the JS layer. Indentation-insensitive so a call site tucked inside a
      // conditional cannot slip past the count.
      const numericCallSites = entrypoint()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('update_numeric_app_config '));

      expect(numericCallSites).to.have.lengthOf(
        NUMERIC_APP_CONFIG_PATHS.length,
      );
      for (const callSite of numericCallSites) {
        const yamlPath = callSite.split(/\s+/)[2].replace(/'/g, '').slice(1);
        expect([...NUMERIC_APP_CONFIG_PATHS], callSite).to.include(yamlPath);
      }
    });

    describe('config.yaml it writes', function () {
      let written;

      before(function () {
        // mikefarah yq v4, as installed by the Dockerfile and the test
        // workflow. The unrelated jq-based python-yq of the same name has no
        // `eval` subcommand. Skipping locally is a convenience; in CI the
        // binary is installed on purpose, so a miss is a real failure.
        const yqVersion = spawnSync('yq', ['--version'], { encoding: 'utf8' });
        // Pinned to the major the image builds from, so CI cannot start
        // validating the entrypoint against a yq production never runs.
        const hasMikefarahYq =
          !yqVersion.error && /mikefarah.*version v4\./i.test(yqVersion.stdout);

        if (!hasMikefarahYq) {
          if (process.env.CI) {
            throw new Error(
              'mikefarah yq v4 is required to test docker-entrypoint.sh ' +
                `but was not found (got: ${
                  yqVersion.error?.message ?? yqVersion.stdout?.trim()
                })`,
            );
          }
          this.skip();
        }

        try {
          written = yaml.load(
            execFileSync('bash', [scriptPath], {
              cwd: repoRoot,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'pipe'],
            }),
          );
        } catch (error) {
          // The script runs under `set -euo pipefail`, so any unexpected abort
          // fails all of the tests below with nothing to go on otherwise.
          throw new Error(
            `${scriptPath} failed: ${error.message}\n${error.stderr ?? ''}`,
            { cause: error },
          );
        }
      });

      it('writes integer env vars as YAML numbers', function () {
        expect(written.APP.DEFAULT_FEE).to.equal(300);
        expect(written.APP.DEFAULT_COIN_AMOUNT).to.equal(300);
      });

      it('keeps digit-only values on non-numeric keys as strings', function () {
        expect(written.V1.CADT_API_KEY).to.equal('12345678');
        expect(written.V1.GOVERNANCE.GOVERNANCE_BODY_ID).to.equal('99999999');
      });

      it('preserves values it cannot write as YAML numbers', function () {
        // yq rejects integers wider than int64 and the writer rejects signs, so
        // both fall through to the quoted writer. The JS layer then replaces
        // them with the documented default and warns, which still beats
        // dropping the operator's setting here without a trace.
        expect(written.APP.TASKS.MIRROR_CHECK_TASK_INTERVAL).to.equal(
          '99999999999999999999',
        );
        expect(written.APP.CW_PORT).to.equal('-5');
      });

      it('leaves numeric keys without an env var at their existing value', function () {
        // The fixture seeds 121 rather than the shipped 120, so this fails if
        // the writer resets an unset key to the default.
        expect(written.APP.TASKS.PICKLIST_SYNC_TASK_INTERVAL).to.equal(121);
      });

      it('leaves boolean, string and empty handling unchanged', function () {
        expect(written.APP.USE_SIMULATOR).to.equal(true);
        expect(written.APP.CHIA_NETWORK).to.equal('testnet');
        expect(written.APP.CERTIFICATE_FOLDER_PATH).to.be.null;
      });
    });
  });
});
