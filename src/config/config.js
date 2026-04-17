import { getConfig, getConfigV2 } from '../utils/config-loader';
import { getChiaRoot } from '../utils/chia-root.js';
import { logger } from './logger.js';
import { createHash } from 'crypto';

const chiaRoot = getChiaRoot();
const persistanceFolder = `${chiaRoot}/cadt/v1`;
const v2PersistanceFolder = `${chiaRoot}/cadt/v2`;

// Test database configuration
// TEST_RUN_ID is set by tests/run-tests.sh to enable parallel test execution.
// Each test run gets its own timestamped database files under tests/test-dbs/.
// Falls back to Date.now() if not set (e.g., running mocha directly).
const testRunId = process.env.TEST_RUN_ID || Date.now().toString();
const testDbDir = './tests/test-dbs';

const localQueryLogger = (query) => {
  const queryString = query.split(/:\s(.+)/)[1];
  const queryHash = createHash('md5').update(queryString).digest('hex');
  logger.silly(`SQLite Sequelize [query hash: ${queryHash}]\n\t${query}`);
};

const mirrorQueryLogger = (query) => {
  const queryString = query.split(/:\s(.+)/)[1];
  const queryHash = createHash('md5').update(queryString).digest('hex');
  logger.silly(`Mirror DB Sequelize [query hash: ${queryHash}]\n\t${query}`);
};

const appLogLevel = getConfig().APP.LOG_LEVEL;
const localLogging = appLogLevel === 'silly' ? localQueryLogger : false;
const mirrorLogging = appLogLevel === 'silly' ? mirrorQueryLogger : false;

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
    storage: `${testDbDir}/test-${testRunId}.sqlite3`,
    logging: false,
  },
  mirrorTest: {
    dialect: 'sqlite',
    storage: `${testDbDir}/testMirror-${testRunId}.sqlite3`,
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
  // V2 Database Configurations
  v2Local: {
    dialect: 'sqlite',
    storage: `${v2PersistanceFolder}/data.sqlite3`,
    logging: localLogging,
    dialectOptions: {
      busyTimeout: 10000,
    },
  },
  v2Simulator: {
    dialect: 'sqlite',
    storage: `${v2PersistanceFolder}/simulator.sqlite3`,
    logging: false,
  },
  v2Test: {
    dialect: 'sqlite',
    storage: `${testDbDir}/test-v2-${testRunId}.sqlite3`,
    logging: false,
    dialectOptions: {
      busyTimeout: 30000, // 30 seconds - allows SQLite to wait for locks instead of immediately failing
    },
  },
  v2MirrorTest: {
    dialect: 'sqlite',
    storage: `${testDbDir}/testMirror-v2-${testRunId}.sqlite3`,
    logging: false,
  },
  v2Mirror: {
    username: getConfigV2().MIRROR_DB?.DB_USERNAME || '',
    password: getConfigV2().MIRROR_DB?.DB_PASSWORD || '',
    database: getConfigV2().MIRROR_DB?.DB_NAME || '',
    host: getConfigV2().MIRROR_DB?.DB_HOST || '',
    dialect: 'mysql',
    logging: mirrorLogging,
  },
};
