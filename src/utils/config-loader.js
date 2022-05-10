import _ from 'lodash';
import yaml from 'js-yaml';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { logger } from '../config/logger.cjs';

import defaultConfig from './defaultConfig.json';

export const getConfig = _.memoize(() => {
  const homeDir = os.homedir();
  const configFile = path.resolve(
    `${homeDir}/.chia/climate-warehouse/config.yaml`,
  );

  try {
    if (!fs.existsSync(configFile)) {
      try {
        fs.mkdir(
          `${homeDir}/.chia/climate-warehouse`,
          { recursive: true },
          (err) => {
            if (err) {
              throw err;
            }

            fs.writeFileSync(configFile, yaml.dump(defaultConfig), 'utf8');
          },
        );
      } catch (err) {
        // if it still doesnt exist that means we are in an env without write permissions
        // so just load the default env
        if (process.env.USE_SIMULATOR) {
          defaultConfig.APP.USE_SIMULATOR = true;
          defaultConfig.APP.CHIA_NETWORK = 'testnet';
          logger.info(`ENV FILE OVERRIDE: RUNNING IN SIMULATOR MODE`);
        }

        return yaml.load(yaml.dump(defaultConfig));
      }
    }

    try {
      const yml = yaml.load(fs.readFileSync(configFile, 'utf8'));

      if (typeof process.env.USE_SIMULATOR === 'string') {
        yml.APP.USE_SIMULATOR = true;
        logger.info(`ENV FILE OVERRIDE: RUNNING IN SIMULATOR MODE`);
      }

      return yml;
    } catch (e) {
      logger.error(`Config file not found at ${configFile}`, e);
    }
  } catch (e) {
    logger.error(`Config file not found at ${configFile}`, e);
  }
});
