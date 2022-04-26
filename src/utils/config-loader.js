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
        if (typeof process.env.USE_SIMULATOR === 'string') {
          defaultConfig.APP.USE_SIMULATOR =
            _.get(process, 'env.USE_SIMULATOR', 'false') === 'true';
        }

        return yaml.load(yaml.dump(defaultConfig));
      }
    }

    return yaml.load(fs.readFileSync(configFile, 'utf8'));
  } catch (e) {
    console.log(`Config file not found at ${configFile}`.e);
  }
});
