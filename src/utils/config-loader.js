import _ from 'lodash';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

import { getDataModelVersion, mergeObjects } from './helpers';
import { defaultConfig } from './defaultConfig.js';
import { getChiaRoot } from './chia-root.js';

export const getConfig = _.memoize(() => {
  const chiaRoot = getChiaRoot();
  const dataModelVersion = getDataModelVersion();
  const persistanceFolder = `${chiaRoot}/cadt/${dataModelVersion}`;
  const configFile = path.resolve(`${persistanceFolder}/config.yaml`);

  try {
    if (!fs.existsSync(configFile)) {
      try {
        if (!fs.existsSync(persistanceFolder)) {
          fs.mkdirSync(persistanceFolder, { recursive: true });
        }

        fs.writeFileSync(configFile, yaml.dump(defaultConfig), 'utf8');
      } catch {
        // if it still doesnt exist that means we are in an env without write permissions
        // so just load the default env
        if (process.env.USE_SIMULATOR) {
          defaultConfig.APP.USE_SIMULATOR = true;
          defaultConfig.APP.CHIA_NETWORK = 'testnet';
          defaultConfig.APP.TASKS.AUDIT_SYNC_TASK_INTERVAL = 30;
          console.log(`ENV FILE OVERRIDE: RUNNING IN SIMULATOR MODE`);
        }

        return defaultConfig;
      }
    }

    try {
      const yml = yaml.load(fs.readFileSync(configFile, 'utf8'));

      if (typeof process.env.USE_SIMULATOR === 'string') {
        yml.APP.USE_SIMULATOR = true;
        console.log(`ENV FILE OVERRIDE: RUNNING IN SIMULATOR MODE`);
      }

      mergeObjects(yml, defaultConfig);
      return yml;
    } catch (e) {
      console.error(`Config file not found at ${configFile}`, e);
    }
  } catch (e) {
    console.error(`Config file not found at ${configFile}`, e);
  }
});
