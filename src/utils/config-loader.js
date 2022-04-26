import _ from 'lodash';
import yaml from 'js-yaml';
import fs from 'fs';
import os from 'os';
import path from 'path';

import defaultConfig from './defaultConfig.json';

export const getConfig = _.memoize(() => {
  const homeDir = os.homedir();
  const configFile = path.resolve(
    `${homeDir}/.chia/climate-warehouse/config.yaml`,
  );

  try {
    if (!fs.existsSync(configFile)) {
      try {
        fs.writeFileSync(configFile, yaml.dump(defaultConfig), 'utf8');
      } catch (err) {
        // if it still doesnt exist that means we are in an env without write permissions
        // so just load the default env
        if (process.env.USE_SIMULATOR) {
          defaultConfig.APP.USE_SIMULATOR = true;
          defaultConfig.APP.CHIA_NETWORK = 'testnet';
        }

        return yaml.load(yaml.dump(defaultConfig));
      }
    }

    try {
      const yml = yaml.load(fs.readFileSync(configFile, 'utf8'));

      if (typeof process.env.USE_SIMULATOR === 'string') {
        yml.APP.USE_SIMULATOR = true;
      }

      return yml;
    } catch (e) {
      console.log(e, `Config file not found at ${configFile}`);
    }
  } catch (e) {
    console.log(`Config file not found at ${configFile}`);
  }
});
