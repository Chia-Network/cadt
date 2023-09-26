import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getChiaRoot } from 'chia-root-resolver';

export const getChiaConfig = _.memoize(() => {
  const chiaRoot = getChiaRoot();
  const persistanceFolder = `${chiaRoot}/config`;
  const configFile = path.resolve(`${persistanceFolder}/config.yaml`);
  return yaml.load(fs.readFileSync(configFile, 'utf8'));
});

export default {
  getChiaConfig,
};
