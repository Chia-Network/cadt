import { getConfig } from '../utils/config-loader';
import { getDataModelVersion } from '../utils/helpers';
import { getChiaRoot } from '../utils/chia-root.js';
import { logger } from './logger.js';

const chiaRoot = getChiaRoot();
const persistanceFolder = `${chiaRoot}/cadt/${getDataModelVersion()}`;

const appLogLevel = getConfig().APP.LOG_LEVEL;
const localLogging =
  appLogLevel === 'silly' || appLogLevel === 'debug'
    ? (query) => logger.debug(`SQLite Sequelize ${query}`)
    : false;
const mirrorLogging =
  appLogLevel === 'silly' || appLogLevel === 'debug'
    ? (query) => logger.debug(`Mirror DB Sequelize ${query}`)
    : false;

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
    username: getConfig().MIRROR_DB.DB_USERNAME || '',
    password: getConfig().MIRROR_DB.DB_PASSWORD || '',
    database: getConfig().MIRROR_DB.DB_NAME || '',
    host: getConfig().MIRROR_DB.DB_HOST || '',
    dialect: 'mysql',
    logging: mirrorLogging,
  },
};
