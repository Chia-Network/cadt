import ConfigManager from '@chia-carbon/core-registry-config';
import { defaultConfig } from './utils/defaultConfig';
const configManager = new ConfigManager('core-registry', defaultConfig);

const loadedConfig = configManager.config;

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
