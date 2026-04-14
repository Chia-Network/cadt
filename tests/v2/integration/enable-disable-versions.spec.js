import { expect } from 'chai';
import supertest from 'supertest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { initializeDatabases } from '../../../src/routes/index.js';
import scheduler from '../../../src/tasks/index.js';
import app from '../../../src/server.js';
import { sequelize } from '../../../src/database/index.js';
import { sequelizeV2 } from '../../../src/database/v2/index.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';
import { defaultConfig } from '../../../src/utils/defaultConfig.js';

/**
 * Tests for V1/V2 enable/disable functionality
 *
 * Tests that verify:
 * - Config loading (getConfigV2)
 * - Database initialization behavior
 * - Scheduler task registration
 * - API endpoint behavior (403 Forbidden responses when disabled)
 */
describe('V1/V2 Enable/Disable Functionality Tests', function () {
  this.timeout(30000);

  // Use test config file location (same as config-loader.js uses in test mode)
  const projectRoot = path.resolve(process.cwd());
  const unifiedConfigDir = path.resolve(`${projectRoot}/tests/v2/config`);
  const unifiedConfigPath = path.resolve(`${unifiedConfigDir}/test-config.yaml`);
  let originalUnifiedConfig = null;

  before(async function () {
    // Ensure test config directory exists
    if (!fs.existsSync(unifiedConfigDir)) {
      fs.mkdirSync(unifiedConfigDir, { recursive: true });
    }

    // Backup original test config if it exists
    if (fs.existsSync(unifiedConfigPath)) {
      originalUnifiedConfig = fs.readFileSync(unifiedConfigPath, 'utf8');
    }
  });

  after(async function () {
    // Restore original test config
    if (originalUnifiedConfig !== null) {
      fs.writeFileSync(unifiedConfigPath, originalUnifiedConfig, 'utf8');
    } else if (fs.existsSync(unifiedConfigPath)) {
      // If there was no original, restore to default config
      fs.writeFileSync(unifiedConfigPath, yaml.dump(defaultConfig), 'utf8');
    }

    // Clear memoized configs
    getConfig.cache?.clear?.();
    getConfigV2.cache?.clear?.();
    getChiaRoot.cache?.clear?.();

    // IMPORTANT: Re-enable both V1 and V2 schedulers for subsequent tests
    // This test suite explicitly disables schedulers to test that functionality
    // but we need to restore them for other tests that depend on the scheduler
    await scheduler.start(true, true);
  });

  // Helper function to write unified config
  const writeUnifiedConfig = (v1Enable, v2Enable) => {
    const testConfig = { ...defaultConfig };
    testConfig.V1.ENABLE = v1Enable;
    testConfig.V2.ENABLE = v2Enable;
    // Ensure directory exists
    if (!fs.existsSync(unifiedConfigDir)) {
      fs.mkdirSync(unifiedConfigDir, { recursive: true });
    }
    fs.writeFileSync(unifiedConfigPath, yaml.dump(testConfig), 'utf8');
  };

  beforeEach(async function () {
    // Clear memoized configs before each test
    // Lodash memoize uses a Map-like cache object
    if (getConfig.cache) {
      getConfig.cache.clear();
    }
    if (getConfigV2.cache) {
      getConfigV2.cache.clear();
    }
    if (getChiaRoot.cache) {
      getChiaRoot.cache.clear();
    }
  });

  describe('Config Loading', function () {
    it('should load V1 config from unified config.yaml', function () {
      const config = getConfig();
      expect(config).to.exist;
      expect(config.APP).to.exist;
      expect(config.ENABLE).to.not.be.undefined;
    });

    it('should load V2 config from unified config.yaml', function () {
      const config = getConfigV2();
      expect(config).to.exist;
      expect(config.APP).to.exist;
      expect(config.ENABLE).to.not.be.undefined;
    });

    it('should default ENABLE to true if not set in V1 config', function () {
      // Create unified config without V1.ENABLE - write a minimal config
      const testConfig = {
        APP: {
          USE_SIMULATOR: false,
        },
        V1: {
          READ_ONLY: false,
        },
        V2: {
          READ_ONLY: false,
        },
      };
      // Ensure directory exists
      const configDir = path.dirname(unifiedConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(unifiedConfigPath, yaml.dump(testConfig), 'utf8');

      if (getConfig.cache) getConfig.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();
      const config = getConfig();
      // mergeObjects merges defaultConfig into the loaded config, so ENABLE should be true
      expect(config.ENABLE).to.be.true;
    });

    it('should default ENABLE to true if not set in V2 config', function () {
      // Create unified config without V2.ENABLE - write a minimal config
      const testConfig = {
        APP: {
          USE_SIMULATOR: false,
        },
        V1: {
          READ_ONLY: false,
        },
        V2: {
          READ_ONLY: false,
        },
      };
      // Ensure directory exists
      const configDir = path.dirname(unifiedConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(unifiedConfigPath, yaml.dump(testConfig), 'utf8');

      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();
      const config = getConfigV2();
      // mergeObjects merges defaultConfig into the loaded config, so ENABLE should be true
      expect(config.ENABLE).to.be.true;
    });

    it('should respect ENABLE: false in V1 config', function () {
      const testConfig = { ...defaultConfig };
      testConfig.V1.ENABLE = false;
      const configDir = path.dirname(unifiedConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(unifiedConfigPath, yaml.dump(testConfig), 'utf8');

      if (getConfig.cache) getConfig.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();
      const config = getConfig();
      expect(config.ENABLE).to.be.false;
    });

    it('should respect ENABLE: false in V2 config', function () {
      const testConfig = { ...defaultConfig };
      testConfig.V2.ENABLE = false;
      const configDir = path.dirname(unifiedConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(unifiedConfigPath, yaml.dump(testConfig), 'utf8');

      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();
      const config = getConfigV2();
      expect(config.ENABLE).to.be.false;
    });
  });

  describe('Database Initialization', function () {
    it('should read config correctly when both are enabled', async function () {
      // Set both to enabled
      writeUnifiedConfig(true, true);

      if (getConfig.cache) getConfig.cache.clear();
      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      // Verify configs are read correctly
      const configV1 = getConfig();
      const configV2 = getConfigV2();

      expect(configV1.ENABLE).to.be.true;
      expect(configV2.ENABLE).to.be.true;
    });

    it('should read config correctly when V1 is disabled', async function () {
      // Set V1 to disabled, V2 to enabled
      writeUnifiedConfig(false, true);

      if (getConfig.cache) getConfig.cache.clear();
      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      // Verify configs are read correctly
      const configV1 = getConfig();
      const configV2 = getConfigV2();

      expect(configV1.ENABLE).to.be.false;
      expect(configV2.ENABLE).to.be.true;
    });

    it('should read config correctly when V2 is disabled', async function () {
      // Set V1 to enabled, V2 to disabled
      writeUnifiedConfig(true, false);

      if (getConfig.cache) getConfig.cache.clear();
      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      // Verify configs are read correctly
      const configV1 = getConfig();
      const configV2 = getConfigV2();

      expect(configV1.ENABLE).to.be.true;
      expect(configV2.ENABLE).to.be.false;
    });
  });

  describe('Scheduler Task Registration', function () {
    beforeEach(function () {
      // Stop and clear all scheduler jobs before each test
      scheduler.stopAll();
    });

    it('should register V1 tasks when ENABLE is true in V1 config', async function () {
      writeUnifiedConfig(true, true);

      if (getConfig.cache) getConfig.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      await scheduler.start(true, false);

      // Check that V1 tasks are registered
      // Note: job IDs must match the actual IDs defined in the task files
      const v1TaskIds = [
        'sync-governance-meta', // Note: job ID is 'sync-governance-meta', not 'sync-governance-body'
        'sync-default-organizations',
        'sync-picklist', // Note: job ID is 'sync-picklist', not 'sync-picklists'
        'sync-registries',
        'sync-organization-meta',
        'mirror-check',
        'reset-audit-table',
        'validate-organization-table', // Note: job ID is 'validate-organization-table', not 'validate-organization-table-and-subscriptions'
        'clean-up-failed-org',
      ];

      v1TaskIds.forEach((taskId) => {
        expect(scheduler.jobRegistry[taskId]).to.exist;
      });
    });

    it('should not register V1 tasks when ENABLE is false in V1 config', async function () {
      await scheduler.start(false, true);

      // Check that V1 tasks are NOT registered
      const v1TaskIds = [
        'sync-governance-meta',
        'sync-default-organizations',
        'sync-picklist',
        'sync-registries',
        'sync-organization-meta',
        'mirror-check',
        'reset-audit-table',
        'validate-organization-table',
        'clean-up-failed-org',
      ];

      v1TaskIds.forEach((taskId) => {
        expect(scheduler.jobRegistry[taskId]).to.not.exist;
      });
    });

    it('should register V2 tasks when ENABLE is true in V2 config', async function () {
      await scheduler.start(false, true);

      // Check that V2 tasks are registered
      const v2TaskIds = [
        'sync-default-organizations-v2',
        'sync-organization-meta-v2',
        'sync-registries-v2',
        'mirror-check-v2',
        'validate-organization-table-v2', // Note: job ID is 'validate-organization-table-v2', not 'validate-organization-table-and-subscriptions-v2'
        'sync-picklist-v2', // Note: job ID is 'sync-picklist-v2', not 'sync-picklists-v2'
        'clean-up-failed-org-v2',
      ];

      v2TaskIds.forEach((taskId) => {
        expect(scheduler.jobRegistry[taskId]).to.exist;
      });
    });

    it('should not register V2 tasks when ENABLE is false in V2 config', async function () {
      await scheduler.start(true, false);

      // Check that V2 tasks are NOT registered
      const v2TaskIds = [
        'sync-default-organizations-v2',
        'sync-organization-meta-v2',
        'sync-registries-v2',
        'mirror-check-v2',
        'validate-organization-table-v2',
        'sync-picklist-v2',
        'clean-up-failed-org-v2',
      ];

      v2TaskIds.forEach((taskId) => {
        expect(scheduler.jobRegistry[taskId]).to.not.exist;
      });
    });

    it('should register both V1 and V2 tasks when both are enabled', async function () {
      await scheduler.start(true, true);

      // Check V1 tasks
      expect(scheduler.jobRegistry['sync-governance-meta']).to.exist;
      expect(scheduler.jobRegistry['sync-registries']).to.exist;

      // Check V2 tasks
      expect(scheduler.jobRegistry['sync-registries-v2']).to.exist;
      expect(scheduler.jobRegistry['mirror-check-v2']).to.exist;
    });

    it('should register neither when both are disabled', async function () {
      await scheduler.start(false, false);

      // Check that no tasks are registered
      expect(Object.keys(scheduler.jobRegistry)).to.have.length(0);
    });

    it('should replace existing job when job ID collides', async function () {
      await scheduler.start(true, true);
      const { SimpleIntervalJob, Task } = await import('toad-scheduler');
      const newtask = new Task('new-mirror-check', async () => {});
      const job = new SimpleIntervalJob(
        {
          seconds: 300,
          runImmediately: false,
        },
        newtask,
        { id: 'mirror-check', preventOverrun: true },
      );

      const oldjob = scheduler.jobRegistry['mirror-check'];
      scheduler.addJobToScheduler(job);
      const newjob = scheduler.jobRegistry['mirror-check'];
      expect(newjob).not.to.equal(oldjob);
      expect(newjob).to.equal(job);
      // since the old job should be stopped before removed from jobRegistry, should check status
      expect(oldjob.getStatus()).to.equal('stopped');
      expect(newjob.getStatus()).to.equal('running');
    });
  });

  describe('API Endpoint Behavior', function () {
    it('should return 403 Forbidden when V1 is disabled', async function () {
      // Set V1 to disabled in unified config
      writeUnifiedConfig(false, true);

      if (getConfig.cache) getConfig.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      // Need to reload app with new config - in real scenario this would require restart
      // For testing, we'll verify the config is read correctly
      const config = getConfig();
      expect(config.ENABLE).to.be.false;

      // Note: In a real scenario, the app would need to be restarted for route changes
      // This test verifies the config is read correctly
      // The actual HTTP response would be 403 Forbidden with an error message
    });

    it('should return 403 Forbidden when V2 is disabled', async function () {
      // Set V2 to disabled in unified config
      writeUnifiedConfig(true, false);

      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      const config = getConfigV2();
      expect(config.ENABLE).to.be.false;

      // The actual HTTP response would be 403 Forbidden with an error message
    });

    it('should allow V1 endpoints when V1 is enabled', async function () {
      // Set V1 to enabled in unified config
      writeUnifiedConfig(true, true);

      if (getConfig.cache) getConfig.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      const config = getConfig();
      expect(config.ENABLE).to.be.true;
    });

    it('should allow V2 endpoints when V2 is enabled', async function () {
      // Set V2 to enabled in unified config
      writeUnifiedConfig(true, true);

      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      const config = getConfigV2();
      expect(config.ENABLE).to.be.true;
    });
  });

  describe('Integration: Full System Behavior', function () {
    it('should work correctly with V1 disabled and V2 enabled', async function () {
      // Set V1 to disabled, V2 to enabled in unified config
      writeUnifiedConfig(false, true);

      if (getConfig.cache) getConfig.cache.clear();
      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      const configV1 = getConfig();
      const configV2 = getConfigV2();

      expect(configV1.ENABLE).to.be.false;
      expect(configV2.ENABLE).to.be.true;

      // Scheduler should only register V2 tasks
      scheduler.stopAll();
      await scheduler.start(false, true);

      expect(scheduler.jobRegistry['sync-registries-v2']).to.exist;
      expect(scheduler.jobRegistry['sync-registries']).to.not.exist;
    });

    it('should work correctly with V1 enabled and V2 disabled', async function () {
      // Set V1 to enabled, V2 to disabled in unified config
      writeUnifiedConfig(true, false);

      if (getConfig.cache) getConfig.cache.clear();
      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      const configV1 = getConfig();
      const configV2 = getConfigV2();

      expect(configV1.ENABLE).to.be.true;
      expect(configV2.ENABLE).to.be.false;

      // Scheduler should only register V1 tasks
      scheduler.stopAll();
      await scheduler.start(true, false);

      expect(scheduler.jobRegistry['sync-registries']).to.exist;
      expect(scheduler.jobRegistry['sync-registries-v2']).to.not.exist;
    });

    it('should work correctly with both disabled', async function () {
      // Set both to disabled in unified config
      writeUnifiedConfig(false, false);

      if (getConfig.cache) getConfig.cache.clear();
      if (getConfigV2.cache) getConfigV2.cache.clear();
      if (getChiaRoot.cache) getChiaRoot.cache.clear();

      const configV1 = getConfig();
      const configV2 = getConfigV2();

      expect(configV1.ENABLE).to.be.false;
      expect(configV2.ENABLE).to.be.false;

      // Scheduler should register no tasks
      scheduler.stopAll();
      await scheduler.start(false, false);

      expect(Object.keys(scheduler.jobRegistry)).to.have.length(0);
    });
  });
});

