import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import os from 'os';
import { migrateConfigFiles } from '../../../src/utils/config-migration.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { defaultConfig } from '../../../src/utils/defaultConfig.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';

describe('Config Migration', () => {
  let testChiaRoot;
  let testCadtDir;
  let unifiedConfigFile;
  let v1ConfigDir;
  let v1ConfigFile;
  let v2ConfigDir;
  let v2ConfigFile;

  beforeEach(() => {
    // Create a temporary directory for testing
    testChiaRoot = path.join(os.tmpdir(), `cadt-test-${Date.now()}`);
    testCadtDir = path.join(testChiaRoot, 'cadt');
    unifiedConfigFile = path.join(testCadtDir, 'config.yaml');
    v1ConfigDir = path.join(testCadtDir, 'v1');
    v2ConfigDir = path.join(testCadtDir, 'v2');
    v1ConfigFile = path.join(v1ConfigDir, 'config.yaml');
    v2ConfigFile = path.join(v2ConfigDir, 'config.yaml');

    // Set CHIA_ROOT environment variable for testing
    process.env.CHIA_ROOT = testChiaRoot;

    // Clear memoization for all config-related functions
    // IMPORTANT: Clear caches BEFORE setting CHIA_ROOT to ensure getChiaRoot picks up the new value
    if (getChiaRoot.cache) {
      getChiaRoot.cache.clear();
    }
    if (getConfig.cache) {
      getConfig.cache.clear();
    }
    if (getConfigV2.cache) {
      getConfigV2.cache.clear();
    }
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testChiaRoot)) {
      fs.rmSync(testChiaRoot, { recursive: true, force: true });
    }
    delete process.env.CHIA_ROOT;
  });

  describe('Migration from V1 config only', () => {
    it('should migrate V1 config to unified config', () => {
      // Create V1 config with custom values
      fs.mkdirSync(v1ConfigDir, { recursive: true });
      const v1Config = {
        APP: {
          CW_PORT: 31311,
          LOG_LEVEL: 'debug',
          USE_SIMULATOR: false,
        },
        MIRROR_DB: {
          DB_USERNAME: 'test_user',
          DB_PASSWORD: 'test_pass',
        },
        GOVERNANCE: {
          GOVERNANCE_BODY_ID: 'test-governance-id-v1',
        },
      };
      fs.writeFileSync(v1ConfigFile, yaml.dump(v1Config), 'utf8');

      // Run migration
      migrateConfigFiles();

      // Verify unified config exists
      expect(fs.existsSync(unifiedConfigFile)).to.be.true;

      // Load and verify unified config
      const unifiedConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
      expect(unifiedConfig.APP.CW_PORT).to.equal(31311);
      expect(unifiedConfig.APP.LOG_LEVEL).to.equal('debug');
      expect(unifiedConfig.V1.MIRROR_DB.DB_USERNAME).to.equal('test_user');
      expect(unifiedConfig.V1.GOVERNANCE.GOVERNANCE_BODY_ID).to.equal('test-governance-id-v1');
      expect(unifiedConfig.V2).to.exist; // V2 should have defaults

      // Verify V1 config renamed to .old
      expect(fs.existsSync(v1ConfigFile)).to.be.false;
      expect(fs.existsSync(`${v1ConfigFile}.old`)).to.be.true;

      // Verify .old file has migration note
      const oldContent = fs.readFileSync(`${v1ConfigFile}.old`, 'utf8');
      expect(oldContent).to.include('migrated to the unified config location');
      expect(oldContent).to.include(unifiedConfigFile);
    });
  });

  describe('Migration from V2 config only', () => {
    it('should migrate V2 config to unified config', () => {
      // Create V2 config with custom values
      fs.mkdirSync(v2ConfigDir, { recursive: true });
      const v2Config = {
        APP: {
          CW_PORT: 31312,
          LOG_LEVEL: 'warn',
        },
        MIRROR_DB: {
          DB_NAME: 'test_db_v2',
        },
        GOVERNANCE: {
          GOVERNANCE_BODY_ID: 'test-governance-id-v2',
        },
      };
      fs.writeFileSync(v2ConfigFile, yaml.dump(v2Config), 'utf8');

      // Run migration
      migrateConfigFiles();

      // Verify unified config exists
      expect(fs.existsSync(unifiedConfigFile)).to.be.true;

      // Load and verify unified config
      const unifiedConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
      expect(unifiedConfig.APP.CW_PORT).to.equal(31312);
      expect(unifiedConfig.APP.LOG_LEVEL).to.equal('warn');
      expect(unifiedConfig.V2.MIRROR_DB.DB_NAME).to.equal('test_db_v2');
      expect(unifiedConfig.V2.GOVERNANCE.GOVERNANCE_BODY_ID).to.equal('test-governance-id-v2');
      expect(unifiedConfig.V1).to.exist; // V1 should have defaults

      // Verify V2 config renamed to .old
      expect(fs.existsSync(v2ConfigFile)).to.be.false;
      expect(fs.existsSync(`${v2ConfigFile}.old`)).to.be.true;
    });
  });

  describe('Migration from both V1 and V2 configs', () => {
    it('should migrate both configs to unified config', () => {
      // Create V1 config
      fs.mkdirSync(v1ConfigDir, { recursive: true });
      const v1Config = {
        APP: {
          CW_PORT: 31311,
          LOG_LEVEL: 'debug',
        },
        MIRROR_DB: {
          DB_USERNAME: 'v1_user',
        },
        GOVERNANCE: {
          GOVERNANCE_BODY_ID: 'v1-governance-id',
        },
      };
      fs.writeFileSync(v1ConfigFile, yaml.dump(v1Config), 'utf8');

      // Create V2 config
      fs.mkdirSync(v2ConfigDir, { recursive: true });
      const v2Config = {
        APP: {
          CW_PORT: 31312,
          LOG_LEVEL: 'warn',
        },
        MIRROR_DB: {
          DB_NAME: 'v2_db',
        },
        GOVERNANCE: {
          GOVERNANCE_BODY_ID: 'v2-governance-id',
        },
      };
      fs.writeFileSync(v2ConfigFile, yaml.dump(v2Config), 'utf8');

      // Run migration
      migrateConfigFiles();

      // Verify unified config exists
      expect(fs.existsSync(unifiedConfigFile)).to.be.true;

      // Load and verify unified config
      const unifiedConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
      // APP should prefer V1 values
      expect(unifiedConfig.APP.CW_PORT).to.equal(31311);
      expect(unifiedConfig.APP.LOG_LEVEL).to.equal('debug');
      // V1 section should have V1 values
      expect(unifiedConfig.V1.MIRROR_DB.DB_USERNAME).to.equal('v1_user');
      expect(unifiedConfig.V1.GOVERNANCE.GOVERNANCE_BODY_ID).to.equal('v1-governance-id');
      // V2 section should have V2 values
      expect(unifiedConfig.V2.MIRROR_DB.DB_NAME).to.equal('v2_db');
      expect(unifiedConfig.V2.GOVERNANCE.GOVERNANCE_BODY_ID).to.equal('v2-governance-id');

      // Verify both configs renamed to .old
      expect(fs.existsSync(v1ConfigFile)).to.be.false;
      expect(fs.existsSync(`${v1ConfigFile}.old`)).to.be.true;
      expect(fs.existsSync(v2ConfigFile)).to.be.false;
      expect(fs.existsSync(`${v2ConfigFile}.old`)).to.be.true;
    });
  });

  describe('Migration with no existing configs', () => {
    it('should create unified config with defaults', () => {
      // No config files exist

      // Run migration
      migrateConfigFiles();

      // Verify unified config exists
      expect(fs.existsSync(unifiedConfigFile)).to.be.true;

      // Load and verify unified config has defaults
      const unifiedConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
      expect(unifiedConfig.APP).to.deep.equal(defaultConfig.APP);
      expect(unifiedConfig.V1).to.deep.equal(defaultConfig.V1);
      expect(unifiedConfig.V2).to.deep.equal(defaultConfig.V2);
    });
  });

  describe('Config loading after migration', () => {
    it('should load V1 config correctly after migration', () => {
      // Create V1 config
      fs.mkdirSync(v1ConfigDir, { recursive: true });
      const v1Config = {
        APP: {
          CW_PORT: 31311,
          LOG_LEVEL: 'debug',
        },
        MIRROR_DB: {
          DB_USERNAME: 'v1_user',
        },
      };
      fs.writeFileSync(v1ConfigFile, yaml.dump(v1Config), 'utf8');

      // Run migration
      migrateConfigFiles();

      // Clear caches to ensure fresh config load from migrated file
      if (getChiaRoot.cache) {
        getChiaRoot.cache.clear();
      }
      if (getConfig.cache) {
        getConfig.cache.clear();
      }

      // Load V1 config via getConfig()
      const configV1 = getConfig();

      // Verify merged structure
      expect(configV1.APP.CW_PORT).to.equal(31311);
      expect(configV1.APP.LOG_LEVEL).to.equal('debug');
      expect(configV1.MIRROR_DB.DB_USERNAME).to.equal('v1_user');
      expect(configV1.ENABLE).to.exist; // Should have ENABLE at top level
    });

    it('should load V2 config correctly after migration', () => {
      // Create V2 config
      fs.mkdirSync(v2ConfigDir, { recursive: true });
      const v2Config = {
        APP: {
          CW_PORT: 31312,
          LOG_LEVEL: 'warn',
        },
        MIRROR_DB: {
          DB_NAME: 'v2_db',
        },
      };
      fs.writeFileSync(v2ConfigFile, yaml.dump(v2Config), 'utf8');

      // Run migration
      migrateConfigFiles();

      // Clear caches to ensure fresh config load from migrated file
      if (getChiaRoot.cache) {
        getChiaRoot.cache.clear();
      }
      if (getConfigV2.cache) {
        getConfigV2.cache.clear();
      }

      // Load V2 config via getConfigV2()
      const configV2 = getConfigV2();

      // Verify merged structure
      expect(configV2.APP.CW_PORT).to.equal(31312);
      expect(configV2.APP.LOG_LEVEL).to.equal('warn');
      expect(configV2.MIRROR_DB.DB_NAME).to.equal('v2_db');
      expect(configV2.ENABLE).to.exist; // Should have ENABLE at top level
    });
  });

  describe('Migration idempotency', () => {
    it('should not migrate if unified config already exists', () => {
      // Create unified config first
      fs.mkdirSync(testCadtDir, { recursive: true });
      const existingConfig = {
        APP: { CW_PORT: 9999 },
        V1: { ENABLE: true },
        V2: { ENABLE: true },
      };
      fs.writeFileSync(unifiedConfigFile, yaml.dump(existingConfig), 'utf8');

      // Create old V1 config
      fs.mkdirSync(v1ConfigDir, { recursive: true });
      const v1Config = { APP: { CW_PORT: 31311 } };
      fs.writeFileSync(v1ConfigFile, yaml.dump(v1Config), 'utf8');

      // Run migration
      migrateConfigFiles();

      // Verify unified config unchanged
      const unifiedConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
      expect(unifiedConfig.APP.CW_PORT).to.equal(9999);

      // Verify V1 config not renamed (migration skipped)
      expect(fs.existsSync(v1ConfigFile)).to.be.true;
      expect(fs.existsSync(`${v1ConfigFile}.old`)).to.be.false;
    });
  });
});

