import { CONFIG } from '../user-config';
import { getDataModelVersion } from '../utils/helpers';
import { getChiaRoot } from 'chia-root-resolver';
import { APP_DATA_FOLDER_NAME } from '../constants';
import { createHash } from 'crypto';
import { logger } from '../logger.js';

const chiaRoot = getChiaRoot();

const persistanceFolder = `${chiaRoot}/${APP_DATA_FOLDER_NAME}/cadt/${getDataModelVersion()}`;

const localQueryLogger = (query) => {
  const queryString = query.split(/:\s(.+)/)[1];
  const queryHash = createHash('md5').update(queryString).digest('hex');
  logger.trace(`SQLite Sequelize [query hash: ${queryHash}]\n\t${query}`);
};

const mirrorQueryLogger = (query) => {
  const queryString = query.split(/:\s(.+)/)[1];
  const queryHash = createHash('md5').update(queryString).digest('hex');
  logger.trace(`Mirror DB Sequelize [query hash: ${queryHash}]\n\t${query}`);
};

const appLogLevel = CONFIG()?.GENERAL?.LOG_LEVEL || 'info';
const localLogging = appLogLevel === 'trace' ? localQueryLogger : false;
const mirrorLogging = appLogLevel === 'trace' ? mirrorQueryLogger : false;

export default {
  local: {
    dialect: 'sqlite',
    storage: `${persistanceFolder}/data.sqlite3`,
    logging: localLogging,
    dialectOptions: {
      busyTimeout: 10000,
    },
  },
  simulator: {
    dialect: 'sqlite',
    storage: `${persistanceFolder}/simulator.sqlite3`,
    logging: false,
  },
  test: {
    dialect: 'sqlite',
    storage: './test.sqlite3',
    logging: false,
  },
  mirrorTest: {
    dialect: 'sqlite',
    storage: './testMirror.sqlite3',
    logging: false,
  },
  mirror: {
    username: CONFIG().CADT.MIRROR_DB.DB_USERNAME || '',
    password: CONFIG().CADT.MIRROR_DB.DB_PASSWORD || '',
    database: CONFIG().CADT.MIRROR_DB.DB_NAME || '',
    host: CONFIG().CADT.MIRROR_DB.DB_HOST || '',
    dialect: 'mysql',
    logging: mirrorLogging,
  },
};
