import Logger from '@chia-carbon/core-registry-logger';
import { CONFIG } from './user-config';
import packageJson from '../package.json' assert { type: 'json' };

const logger = new Logger({
  namespace: 'core-registry',
  projectName: 'cadt',
  logLevel: CONFIG().GENERAL.LOG_LEVEL,
  packageVersion: packageJson.version,
});

export { logger };
