import Sequelize from 'sequelize';
import moment from 'moment';
import { getConfig, getConfigV2 } from '../utils/config-loader';
import { getChiaRoot } from '../utils/chia-root.js';
import { logger } from './logger.js';
import { createHash } from 'crypto';

// Strip the " +00:00" offset suffix from Sequelize's base DATE serialiser.
//
// Sequelize 6's default BaseTypes.DATE._stringify formats Date values as
//   "YYYY-MM-DD HH:mm:ss.SSS Z"    (e.g. "2026-04-17 19:12:48.720 +00:00")
// which recent MariaDB strict mode rejects with:
//   Incorrect datetime value: '2026-04-17 19:12:48.720 +00:00'
//     for column `cadt_mirror_test`.`audit`.`createdAt` at row 1
//
// The mysql-specific subclass overrides _stringify to a safer format
// ("YYYY-MM-DD HH:mm:ss") and is always invoked for attribute-typed
// writes on a MySQL dialect. However, V1 live-api CI reproducibly shows
// the base format reaching MariaDB on Audit.create mirror writes even
// with the mysql subclass wired up - presumably via some Sequelize
// internal path that prototype-invokes the base method rather than
// dispatching through the resolved attribute type. Rather than continue
// bisecting Sequelize internals, patch the base emitter to drop the
// offset suffix. The ".SSS" fractional-seconds form is kept so local
// SQLite round-trips preserve millisecond precision (sqlite.DATE inherits
// this _stringify - it doesn't define its own). Legacy rows written in
// the pre-patch "... +00:00" form still round-trip via sqlite.DATE.parse
// because its `date.includes("+")` branch returns `new Date(str)`
// directly.
//
// MariaDB strict mode accepts ".SSS" (rounds half-up to whole seconds on
// DATETIME(0) columns). CADT's mirror verification helpers
// (tests/v{1,2}/live-api/helpers/mysql-mirror-helpers.js) compare on
// the YYYY-MM-DD prefix only, so the rounding is not observable.

// Diagnostic counters for the patched base _stringify below. Gated by
// CADT_DATE_STRINGIFY_DIAG so tests and production runs don't pay the
// stack-capture cost or spam the logger. This block is TEMPORARY - it
// exists to identify the specific Sequelize entry point that reaches
// the base _stringify despite the mysql.DATE subclass being wired up.
// Remove once that path is understood and documented in the comment
// above.
const MAX_BASE_STRINGIFY_STACKS = 8;
let baseStringifyDiagCount = 0;
const baseStringifyDiagEnabled =
  process.env.CADT_DATE_STRINGIFY_DIAG !== undefined
    ? process.env.CADT_DATE_STRINGIFY_DIAG !== '0' &&
      process.env.CADT_DATE_STRINGIFY_DIAG !== 'false'
    : false;

Sequelize.DataTypes.DATE.prototype._stringify = function _stringify(
  date,
  options,
) {
  // TEMPORARY DIAGNOSTIC - see MAX_BASE_STRINGIFY_STACKS block above.
  if (
    baseStringifyDiagEnabled &&
    baseStringifyDiagCount < MAX_BASE_STRINGIFY_STACKS
  ) {
    baseStringifyDiagCount += 1;
    const stack = new Error('[DATE-diag]').stack
      .split('\n')
      .slice(1, 12)
      .join('\n');
    const valueStr =
      date instanceof Date
        ? date.toISOString()
        : moment.isMoment(date)
          ? date.toISOString()
          : String(date);
    const dialectHint = this?.constructor?.name || 'unknown';
    logger.warn(
      `[DATE-diag] base _stringify called ` +
        `(${baseStringifyDiagCount}/${MAX_BASE_STRINGIFY_STACKS}) ` +
        `value=${valueStr} ` +
        `timezone=${options?.timezone ?? 'unset'} ` +
        `this.constructor.name=${dialectHint}\n` +
        stack,
    );
  }
  if (!moment.isMoment(date)) {
    date = this._applyTimezone(date, options);
  }
  return date.format('YYYY-MM-DD HH:mm:ss.SSS');
};

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
