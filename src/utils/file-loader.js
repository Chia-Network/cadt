import _ from 'lodash';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

import { logger } from '../config/logger.cjs';

export const fileLoader = _.memoize((filepath) => {
  logger.debug(`Reading file at ${filepath}`);

  const file = path.resolve(filepath);

  try {
    return yaml.load(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    logger.error(`File not found at ${file}`, e);
  }
});
