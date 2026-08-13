import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as yaml from 'js-yaml';

import TaskManager from '../../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';

describe('USE_SIMULATOR env override', function () {
  let testChiaRoot;
  let configFile;
  let savedUseSimulator;
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
    TaskManager.stopAll();
  });

  beforeEach(function () {
    testChiaRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cadt-use-simulator-env-'),
    );
    fs.mkdirSync(path.join(testChiaRoot, 'cadt'), { recursive: true });
    configFile = path.join(testChiaRoot, 'cadt', 'config.yaml');

    savedUseSimulator = process.env.USE_SIMULATOR;
    savedChiaRoot = process.env.CHIA_ROOT;
    delete process.env.USE_SIMULATOR;
    process.env.CHIA_ROOT = testChiaRoot;
    clearConfigCaches();
  });

  afterEach(function () {
    fs.rmSync(testChiaRoot, { recursive: true, force: true });
    restoreEnv('CHIA_ROOT', savedChiaRoot);
    restoreEnv('USE_SIMULATOR', savedUseSimulator);
    clearConfigCaches();
  });

  it('leaves YAML false when the env var is unset', function () {
    writeConfig({ USE_SIMULATOR: false, CHIA_NETWORK: 'mainnet' });

    expect(getConfig().APP.USE_SIMULATOR).to.equal(false);
    expect(getConfig().APP.CHIA_NETWORK).to.equal('mainnet');
  });

  it('leaves YAML true when the env var is unset', function () {
    writeConfig({ USE_SIMULATOR: true, CHIA_NETWORK: 'mainnet' });

    expect(getConfig().APP.USE_SIMULATOR).to.equal(true);
    expect(getConfig().APP.CHIA_NETWORK).to.equal('mainnet');
  });

  it('enables simulator mode only for the string true', function () {
    writeConfig({ USE_SIMULATOR: false, CHIA_NETWORK: 'mainnet' });

    process.env.USE_SIMULATOR = 'true';
    clearConfigCaches();

    const app = getConfig().APP;
    expect(app.USE_SIMULATOR).to.equal(true);
    expect(app.CHIA_NETWORK).to.equal('testnet');
  });

  it('does not enable simulator mode for USE_SIMULATOR=false', function () {
    writeConfig({ USE_SIMULATOR: true, CHIA_NETWORK: 'mainnet' });

    process.env.USE_SIMULATOR = 'false';
    clearConfigCaches();

    const app = getConfig().APP;
    expect(app.USE_SIMULATOR).to.equal(false);
    expect(app.CHIA_NETWORK).to.equal('mainnet');
  });

  it('treats other set values as false', function () {
    writeConfig({ USE_SIMULATOR: true, CHIA_NETWORK: 'mainnet' });

    for (const value of ['', '0', 'FALSE', 'yes']) {
      process.env.USE_SIMULATOR = value;
      clearConfigCaches();
      expect(getConfig().APP.USE_SIMULATOR, JSON.stringify(value)).to.equal(
        false,
      );
    }
  });

  it('applies the same override to the V2 config', function () {
    writeConfig({ USE_SIMULATOR: true, CHIA_NETWORK: 'mainnet' });

    process.env.USE_SIMULATOR = 'false';
    clearConfigCaches();

    expect(getConfigV2().APP.USE_SIMULATOR).to.equal(false);
    expect(getConfigV2().APP.CHIA_NETWORK).to.equal('mainnet');
  });
});
