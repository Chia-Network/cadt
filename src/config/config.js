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
// WHY PATCH THE BASE CLASS WHEN MYSQL HAS ITS OWN _stringify?
// A CI stack-trace diagnostic (removed in a follow-up commit) confirmed
// that the base _stringify is invoked only for SQLite writes - every
// MySQL mirror write correctly dispatches through mysql.DATE._stringify,
// which already emits the safe "YYYY-MM-DD HH:mm:ss" format. So the
// rejected strings MariaDB was seeing were not produced during a MySQL
// write at all: they were produced during a SQLite source write, then
// forwarded verbatim to MariaDB by a code path that did not re-parse
// them.
//
// The known such path is the reconnect-backfill, fixed separately by
// dropping `raw: true` from `source.findAll` in backfillMirror[V2] and
// using `.get({ plain: true, raw: true })` on the resulting instances
// (raw:true-only returns unparsed SQLite strings; instance construction
// runs sqlite.DATE.parse so DATE columns become Date objects). However,
// empirical CI comparison shows the backfill fix alone is insufficient
// - there is at least one additional path that forwards SQLite-stored
// strings to MariaDB without going through _stringify, which I was
// unable to isolate. Patching the base emitter covers that unknown
// path by ensuring SQLite never persists the " +00:00" form in the
// first place.
//
// Format choice: "YYYY-MM-DD HH:mm:ss.SSS" - drop the offset, keep
// millisecond precision. Keeping .SSS preserves round-trip equality
// for SQLite reads (sqlite.DATE inherits this _stringify - it does not
// define its own) and is required by V1 integration tests that compare
// fixture dates byte-for-byte after a create-read round trip. MariaDB
// strict mode accepts .SSS (rounds half-up to whole seconds on
// DATETIME(0) columns); CADT's mirror verification helpers
// (tests/v{1,2}/live-api/helpers/mysql-mirror-helpers.js) compare on
// the YYYY-MM-DD prefix only, so the rounding is not observable.
//
// Legacy rows written in the pre-patch " +00:00" form still round-trip
// via sqlite.DATE.parse because its `date.includes("+")` branch returns
// `new Date(str)` directly.
Sequelize.DataTypes.DATE.prototype._stringify = function _stringify(
  date,
  options,
) {
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
