import ConfigManager from '@chia-carbon/core-registry-config';
import { defaultConfig } from './utils/defaultConfig.js';
import { APP_DATA_FOLDER_NAME } from './constants';
import { mergeObjects } from './utils/helpers.js';
const configManager = new ConfigManager(APP_DATA_FOLDER_NAME, defaultConfig);

const loadedConfig = configManager.config;
mergeObjects(loadedConfig, defaultConfig);

let exportedConfig =
  process.env.NODE_ENV === 'test' ? defaultConfig : loadedConfig;

if (process.env.USE_SIMULATOR) {
  console.log(`ENV FILE OVERRIDE: RUNNING IN SIMULATOR MODE`);
}

export const CONFIG = () => {
  if (process.env.USE_SIMULATOR) {
    exportedConfig.CADT.USE_SIMULATOR = true;
    exportedConfig.CADT.CHIA_NETWORK = 'testnet';
    exportedConfig.GENERAL.LOG_LEVEL = 'trace';
  }

  return exportedConfig;
};

export const setConfig = (config) => {
  exportedConfig = config;
};
