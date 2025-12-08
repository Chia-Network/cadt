import _ from 'lodash';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

import { mergeObjects } from './helpers';
import { defaultConfig } from './defaultConfig.js';
import { getChiaRoot } from './chia-root.js';
import { migrateConfigFiles } from './config-migration.js';

// Helper function to load config for a specific version
const loadConfigForVersion = (dataModelVersion) => {
  const chiaRoot = getChiaRoot();

  // Use test config file when running tests, UNLESS CHIA_ROOT is explicitly set
  // (This allows migration tests to override the config location)
  const isTestMode = process.env.NODE_ENV === 'test';
  const hasExplicitChiaRoot = !!process.env.CHIA_ROOT;
  let unifiedConfigFile;
  let unifiedConfigDir;

  if (isTestMode && !hasExplicitChiaRoot) {
    // Use test-specific config file in project directory (default test behavior)
    const projectRoot = path.resolve(process.cwd());
    unifiedConfigDir = path.resolve(`${projectRoot}/tests/v2/config`);
    unifiedConfigFile = path.resolve(`${unifiedConfigDir}/test-config.yaml`);
  } else {
    // Use production config file (or temp directory if CHIA_ROOT is set for migration tests)
    unifiedConfigDir = `${chiaRoot}/cadt`;
    unifiedConfigFile = path.resolve(`${unifiedConfigDir}/config.yaml`);
  }

  // Check for old config files and migrate if needed (only in production mode)
  if (!isTestMode) {
    const v1ConfigFile = path.resolve(`${chiaRoot}/cadt/v1/config.yaml`);
    const v2ConfigFile = path.resolve(`${chiaRoot}/cadt/v2/config.yaml`);

    if (fs.existsSync(v1ConfigFile) || fs.existsSync(v2ConfigFile)) {
      if (!fs.existsSync(unifiedConfigFile)) {
        // Old config files exist but unified config doesn't - run migration
        try {
          migrateConfigFiles();
        } catch (error) {
          console.error(`Config migration failed: ${error.message}`);
          // If migration fails, try to continue with defaults
          // This allows the system to start even if migration has issues
        }
      }
    }
  }

  // Ensure unified config directory exists
  if (!fs.existsSync(unifiedConfigDir)) {
    try {
      fs.mkdirSync(unifiedConfigDir, { recursive: true });
    } catch (error) {
      console.warn(`Could not create config directory ${unifiedConfigDir}:`, error.message);
    }
  }

  // Load unified config file
  let unifiedConfig = null;

  try {
    if (!fs.existsSync(unifiedConfigFile)) {
      // Create unified config file with defaults if it doesn't exist
      try {
        fs.writeFileSync(unifiedConfigFile, yaml.dump(defaultConfig), 'utf8');
        console.log(`Created unified config file: ${unifiedConfigFile}`);
        unifiedConfig = { ...defaultConfig };
      } catch (error) {
        // If we can't write, use defaults
        console.warn(`Could not create unified config file: ${error.message}`);
        unifiedConfig = { ...defaultConfig };
      }
    } else {
      // Load existing unified config
      try {
        const yml = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
        unifiedConfig = yml;
      } catch (error) {
        console.error(`Error loading unified config file: ${error.message}`);
        unifiedConfig = { ...defaultConfig };
      }
    }
  } catch (error) {
    // If we can't access the config file, use defaults
    console.warn(`Could not access unified config file: ${error.message}`);
    unifiedConfig = { ...defaultConfig };
  }

  // Merge with defaults to ensure all fields are present
  mergeObjects(unifiedConfig, defaultConfig);

  // Extract the appropriate section based on version
  // Keep APP nested for compatibility with existing code (getConfig().APP.LOG_LEVEL)
  let mergedConfig;
  if (dataModelVersion === 'v1') {
    // Merge APP + V1 sections for V1, keeping APP nested
    mergedConfig = {
      APP: { ...unifiedConfig.APP },
      MIRROR_DB: { ...unifiedConfig.V1.MIRROR_DB },
      GOVERNANCE: { ...unifiedConfig.V1.GOVERNANCE },
      // V1-specific top-level values
      ENABLE: unifiedConfig.V1.ENABLE,
      READ_ONLY: unifiedConfig.V1.READ_ONLY,
      CADT_API_KEY: unifiedConfig.V1.CADT_API_KEY,
      IS_GOVERNANCE_BODY: unifiedConfig.V1.IS_GOVERNANCE_BODY,
    };
  } else if (dataModelVersion === 'v2') {
    // Merge APP + V2 sections for V2, keeping APP nested
    mergedConfig = {
      APP: { ...unifiedConfig.APP },
      MIRROR_DB: { ...unifiedConfig.V2.MIRROR_DB },
      GOVERNANCE: { ...unifiedConfig.V2.GOVERNANCE },
      // V2-specific top-level values
      ENABLE: unifiedConfig.V2.ENABLE,
      READ_ONLY: unifiedConfig.V2.READ_ONLY,
      CADT_API_KEY: unifiedConfig.V2.CADT_API_KEY,
      IS_GOVERNANCE_BODY: unifiedConfig.V2.IS_GOVERNANCE_BODY,
    };
  } else {
    // Fallback to APP section only
    mergedConfig = {
      APP: { ...unifiedConfig.APP },
    };
  }

  // Handle USE_SIMULATOR environment variable override
  if (typeof process.env.USE_SIMULATOR === 'string') {
    mergedConfig.APP.USE_SIMULATOR = true;
    mergedConfig.APP.CHIA_NETWORK = 'testnet';
    if (mergedConfig.APP.TASKS) {
      mergedConfig.APP.TASKS.AUDIT_SYNC_TASK_INTERVAL = 30;
    }
    console.log(`ENV FILE OVERRIDE: RUNNING IN SIMULATOR MODE`);
  }

  return mergedConfig;
};

export const getConfig = _.memoize(() => {
  return loadConfigForVersion('v1');
});

export const getConfigV2 = _.memoize(() => {
  return loadConfigForVersion('v2');
});

/**
 * Get the active config - prefers V1 if enabled, otherwise uses V2
 * This is useful for shared resources like wallet RPC that both versions use
 */
export const getActiveConfig = () => {
  const configV1 = getConfig();
  const configV2 = getConfigV2();
  // ENABLE is at top level after merge
  const enableV1 = configV1?.ENABLE !== false; // Default to true if not set
  const enableV2 = configV2?.ENABLE !== false; // Default to true if not set

  // Prefer V1 if enabled, otherwise use V2
  if (enableV1) {
    return configV1;
  } else if (enableV2) {
    return configV2;
  }

  // Fallback to V1 if both are disabled (shouldn't happen in practice)
  return configV1;
};
