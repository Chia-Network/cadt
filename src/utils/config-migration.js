import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { getChiaRoot } from './chia-root.js';
import { defaultConfig } from './defaultConfig.js';
import { mergeObjects } from './helpers.js';

/**
 * Migrates existing V1/V2 config files to unified config.yaml
 * Detects old config files, checks write permissions, migrates data, and renames old files
 */
export const migrateConfigFiles = () => {
  const chiaRoot = getChiaRoot();
  const unifiedConfigDir = `${chiaRoot}/cadt`;
  const unifiedConfigFile = path.resolve(`${unifiedConfigDir}/config.yaml`);

  const v1ConfigDir = `${chiaRoot}/cadt/v1`;
  const v1ConfigFile = path.resolve(`${v1ConfigDir}/config.yaml`);

  const v2ConfigDir = `${chiaRoot}/cadt/v2`;
  const v2ConfigFile = path.resolve(`${v2ConfigDir}/config.yaml`);

  // Check if unified config already exists - if so, migration already done
  if (fs.existsSync(unifiedConfigFile)) {
    return; // Migration already completed
  }

  // Check for old config files
  const v1ConfigExists = fs.existsSync(v1ConfigFile);
  const v2ConfigExists = fs.existsSync(v2ConfigFile);

  // If no old config files exist, create unified config with defaults
  if (!v1ConfigExists && !v2ConfigExists) {
    try {
      // Ensure directory exists
      if (!fs.existsSync(unifiedConfigDir)) {
        fs.mkdirSync(unifiedConfigDir, { recursive: true });
      }

      // Write default unified config
      fs.writeFileSync(unifiedConfigFile, yaml.dump(defaultConfig), 'utf8');
      console.log(`Created unified config file: ${unifiedConfigFile}`);
      return;
    } catch (error) {
      console.error(`Error creating unified config file: ${error.message}`);
      throw error;
    }
  }

  // Check write permissions before proceeding
  try {
    // Ensure directory exists
    if (!fs.existsSync(unifiedConfigDir)) {
      fs.mkdirSync(unifiedConfigDir, { recursive: true });
    }

    // Test write permissions by attempting to write a temporary file
    const testFile = path.resolve(`${unifiedConfigDir}/.write-test`);
    try {
      fs.writeFileSync(testFile, 'test', 'utf8');
      fs.unlinkSync(testFile);
    } catch (error) {
      throw new Error(
        `Cannot write to unified config file location: ${unifiedConfigDir}\n` +
        `Please ensure the directory exists and has write permissions.\n` +
        `Error: ${error.message}`
      );
    }
  } catch (error) {
    if (error.message.includes('Cannot write')) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  // Load existing config files
  let v1Config = null;
  let v2Config = null;

  if (v1ConfigExists) {
    try {
      const v1Content = fs.readFileSync(v1ConfigFile, 'utf8');
      v1Config = yaml.load(v1Content);
      console.log(`Loaded V1 config from: ${v1ConfigFile}`);
    } catch (error) {
      console.warn(`Error loading V1 config file: ${error.message}`);
      // Continue with migration using defaults for V1
    }
  }

  if (v2ConfigExists) {
    try {
      const v2Content = fs.readFileSync(v2ConfigFile, 'utf8');
      v2Config = yaml.load(v2Content);
      console.log(`Loaded V2 config from: ${v2ConfigFile}`);
    } catch (error) {
      console.warn(`Error loading V2 config file: ${error.message}`);
      // Continue with migration using defaults for V2
    }
  }

  // Define fields that should ONLY exist in V1/V2 sections, NOT in APP
  // These fields were in APP in old v1 configs but must be version-specific now
  const versionSpecificFields = [
    'ENABLE',
    'READ_ONLY',
    'CADT_API_KEY',
    'IS_GOVERNANCE_BODY',
  ];

  // Build unified config structure - ONLY these three keys allowed at root
  const unifiedConfig = {
    APP: {},
    V1: {},
    V2: {},
  };

  // Extract APP section (shared config)
  // Prefer V1 APP if it exists, otherwise use V2 APP, otherwise use defaults
  // IMPORTANT: Filter out version-specific fields that should NOT be in APP
  const sourceAppConfig = v1Config?.APP || v2Config?.APP || {};
  const filteredAppConfig = Object.fromEntries(
    Object.entries(sourceAppConfig).filter(
      ([key]) => !versionSpecificFields.includes(key),
    ),
  );
  unifiedConfig.APP = { ...defaultConfig.APP, ...filteredAppConfig };

  // Extract V1-specific sections
  // Get values from V1 config, handling both old format (values in APP) and root-level sections
  const v1Enable = v1Config?.APP?.ENABLE ?? defaultConfig.V1.ENABLE;
  const v1ReadOnly = v1Config?.APP?.READ_ONLY ?? defaultConfig.V1.READ_ONLY;
  const v1CadtApiKey =
    v1Config?.APP?.CADT_API_KEY ?? defaultConfig.V1.CADT_API_KEY;
  const v1IsGovernanceBody =
    v1Config?.APP?.IS_GOVERNANCE_BODY ?? defaultConfig.V1.IS_GOVERNANCE_BODY;
  const v1Governance = v1Config?.GOVERNANCE ?? defaultConfig.V1.GOVERNANCE;
  const v1MirrorDb = v1Config?.MIRROR_DB ?? defaultConfig.V1.MIRROR_DB;

  if (v1Config) {
    unifiedConfig.V1 = {
      ENABLE: v1Enable,
      READ_ONLY: v1ReadOnly,
      CADT_API_KEY: v1CadtApiKey,
      IS_GOVERNANCE_BODY: v1IsGovernanceBody,
      GOVERNANCE: v1Governance,
      MIRROR_DB: v1MirrorDb,
    };
  } else {
    unifiedConfig.V1 = { ...defaultConfig.V1 };
  }

  // Extract V2-specific sections
  // If V2 config exists, use its values; otherwise inherit from V1 or use defaults
  if (v2Config) {
    unifiedConfig.V2 = {
      ENABLE: v2Config.APP?.ENABLE ?? defaultConfig.V2.ENABLE,
      READ_ONLY: v2Config.APP?.READ_ONLY ?? defaultConfig.V2.READ_ONLY,
      // CADT_API_KEY must always be present in V2
      CADT_API_KEY:
        v2Config.APP?.CADT_API_KEY ?? defaultConfig.V2.CADT_API_KEY,
      IS_GOVERNANCE_BODY:
        v2Config.APP?.IS_GOVERNANCE_BODY ?? defaultConfig.V2.IS_GOVERNANCE_BODY,
      GOVERNANCE: v2Config.GOVERNANCE ?? defaultConfig.V2.GOVERNANCE,
      MIRROR_DB: v2Config.MIRROR_DB ?? defaultConfig.V2.MIRROR_DB,
    };
  } else {
    // V2 config doesn't exist - use defaults, only inherit CADT_API_KEY from V1
    // IMPORTANT: CADT_API_KEY should inherit from V1 if V1 had one set
    // NOTE: GOVERNANCE_BODY_ID should NOT be inherited - V2 governance may be different
    unifiedConfig.V2 = {
      ENABLE: defaultConfig.V2.ENABLE,
      READ_ONLY: defaultConfig.V2.READ_ONLY,
      // Inherit CADT_API_KEY from V1 if it was set, otherwise use default
      CADT_API_KEY: v1CadtApiKey ?? defaultConfig.V2.CADT_API_KEY,
      IS_GOVERNANCE_BODY: defaultConfig.V2.IS_GOVERNANCE_BODY,
      // Do NOT inherit GOVERNANCE from V1 - use defaults (V2 governance may be different)
      GOVERNANCE: { ...defaultConfig.V2.GOVERNANCE },
      MIRROR_DB: { ...defaultConfig.V2.MIRROR_DB },
    };
  }

  // Merge with defaults to ensure all nested fields are present
  // This only adds missing keys, doesn't overwrite existing values
  mergeObjects(unifiedConfig, defaultConfig);

  // Ensure CADT_API_KEY is always explicitly present in V2 (even if null)
  // This handles edge cases where mergeObjects might not set it
  if (!('CADT_API_KEY' in unifiedConfig.V2)) {
    unifiedConfig.V2.CADT_API_KEY = v1CadtApiKey ?? defaultConfig.V2.CADT_API_KEY;
  }

  // Write unified config file
  try {
    fs.writeFileSync(unifiedConfigFile, yaml.dump(unifiedConfig), 'utf8');
    console.log(`Created unified config file: ${unifiedConfigFile}`);
  } catch (error) {
    console.error(`Error writing unified config file: ${error.message}`);
    throw error;
  }

  // Rename old config files to .old after successful migration
  if (v1ConfigExists) {
    try {
      const v1OldFile = `${v1ConfigFile}.old`;
      const migrationNote = `# This config file has been migrated to the unified config location.\n` +
        `# New config file location: ${unifiedConfigFile}\n` +
        `# This file is kept for reference and can be safely deleted.\n` +
        `#\n\n`;

      const v1Content = fs.readFileSync(v1ConfigFile, 'utf8');
      fs.writeFileSync(v1OldFile, migrationNote + v1Content, 'utf8');
      fs.unlinkSync(v1ConfigFile);
      console.log(`Renamed V1 config to: ${v1OldFile}`);
    } catch (error) {
      console.warn(`Error renaming V1 config file: ${error.message}`);
      // Don't throw - migration succeeded, just couldn't rename
    }
  }

  if (v2ConfigExists) {
    try {
      const v2OldFile = `${v2ConfigFile}.old`;
      const migrationNote = `# This config file has been migrated to the unified config location.\n` +
        `# New config file location: ${unifiedConfigFile}\n` +
        `# This file is kept for reference and can be safely deleted.\n` +
        `#\n\n`;

      const v2Content = fs.readFileSync(v2ConfigFile, 'utf8');
      fs.writeFileSync(v2OldFile, migrationNote + v2Content, 'utf8');
      fs.unlinkSync(v2ConfigFile);
      console.log(`Renamed V2 config to: ${v2OldFile}`);
    } catch (error) {
      console.warn(`Error renaming V2 config file: ${error.message}`);
      // Don't throw - migration succeeded, just couldn't rename
    }
  }

  console.log('Config migration completed successfully');
};

