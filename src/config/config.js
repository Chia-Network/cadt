import Sequelize from 'sequelize';
import moment from 'moment';
import { getConfig, getConfigV2 } from '../utils/config-loader';
import { getChiaRoot } from '../utils/chia-root.js';
import { logger } from './logger.js';
import { createHash } from 'crypto';

// Force MariaDB-compatible datetime serialisation across all code paths.
//
// Sequelize 6's default BaseTypes.DATE._stringify formats dates as
//   "YYYY-MM-DD HH:mm:ss.SSS Z"        (e.g. "2026-04-17 17:07:13.399 +00:00")
// which recent MariaDB strict mode rejects:
//   Incorrect datetime value: '2026-04-17 17:07:13.399 +00:00'
//     for column `cadt_mirror_test`.`audit`.`createdAt` at row 1
//
// The mysql-specific subclass emits a safe format ("YYYY-MM-DD HH:mm:ss"),
// but some runtime paths in Sequelize end up calling the BASE class's
// _stringify even when the column belongs to a MySQL dialect. Observed
// in CI: V2 mirror produced ~60 "Incorrect datetime value" errors per
// live-api run even with `timezone: "+00:00"` set at the Sequelize
// constructor level.
//
// Fix: patch BASE DATE._stringify to emit the MariaDB-safe format, and
// explicitly restore the original "YYYY-MM-DD HH:mm:ss.SSS Z" format on
// the SQLite subclass (whose `parse()` relies on the trailing offset
// for round-trip). This leaves MySQL/MariaDB writes safe regardless of
// which dispatch path Sequelize chooses, without breaking SQLite.
const _origBaseStringify = Sequelize.DataTypes.DATE.prototype._stringify;
Sequelize.DataTypes.DATE.prototype._stringify = function _stringify(
  date,
  options,
) {
  if (!moment.isMoment(date)) {
    date = this._applyTimezone(date, options);
  }
  // Drop fractional seconds and the " Z" offset. MariaDB strict mode
  // rejects " +00:00". CADT doesn't use sub-second resolution on any
  // DATE column.
  return date.format('YYYY-MM-DD HH:mm:ss');
};
// SQLite's DATE class only overrides `parse`, not `_stringify`, so the
// base-class patch above would otherwise silently change the format of
// SQLite writes. SQLite's `parse()` appends options.timezone when the
// string lacks a "+"/"-" offset - if we stripped the offset on write,
// parse() would concatenate the offset on read, producing a value
// different from what was written. Shadow an own-property `_stringify`
// on `sqlite.DATE.prototype` that points to the original base
// serialiser, so SQLite retains the "YYYY-MM-DD HH:mm:ss.SSS Z" format.
if (Sequelize.DataTypes.sqlite && Sequelize.DataTypes.sqlite.DATE) {
  Sequelize.DataTypes.sqlite.DATE.prototype._stringify = _origBaseStringify;
}

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
    // Tell Sequelize to serialise Date values as UTC without a trailing
    // "+00:00" offset. Recent MariaDB strict mode rejects the
    // "YYYY-MM-DD HH:MM:SS.SSS +00:00" format Sequelize emits by default,
    // with errors like:
    //   Incorrect datetime value: '2026-04-16 22:41:27.490 +00:00'
    //     for column `cadt_mirror_test`.`audit`.`createdAt` at row 1
    // Setting timezone at the Sequelize constructor level (as opposed to
    // Model.init, where it is silently ignored) produces the MariaDB-safe
    // "YYYY-MM-DD HH:MM:SS" format. Without this, every mirror write that
    // touches a DATE/DATETIME column is silently dropped by the
    // fire-and-forget safeMirrorDbHandler.
    timezone: '+00:00',
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
    // See comment on `mirror` above. Same MariaDB strict-mode datetime
    // issue applies to V2.
    timezone: '+00:00',
  },
};
