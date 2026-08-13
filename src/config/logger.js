import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import os from 'os';
import path from 'path';
import packageJson from '../../package.json' with { type: 'json' };
import { getConfig } from '../utils/config-loader.js';
import { redactHeaders } from '../utils/log-redaction.js';

const { format, transports, createLogger } = winston;

// Strip credential values from a record's top-level `headers` field before any
// transport sees it. Only the `info.headers` and `info.metadata.headers` shapes
// are covered — a header map nested deeper than that still reaches the log
// stream. Both shapes are handled so this stays correct wherever it sits in the
// chain relative to format.metadata(), which relocates extra fields under
// info.metadata.
const redactSensitiveFields = format((info) => {
  if (info.headers) {
    info.headers = redactHeaders(info.headers);
  }
  if (info.metadata?.headers) {
    // Copy rather than assign into info.metadata: when this format runs before
    // format.metadata(), info.metadata is still the caller's own object.
    info.metadata = {
      ...info.metadata,
      headers: redactHeaders(info.metadata.headers),
    };
  }
  return info;
});

const getChiaRoot = () => {
  let chiaRoot;

  if (process.env.CHIA_ROOT) {
    chiaRoot = path.resolve(process.env.CHIA_ROOT);
  } else {
    const homeDir = os.homedir();
    chiaRoot = path.resolve(`${homeDir}/.chia/mainnet`);
  }

  return chiaRoot;
};

const chiaRoot = getChiaRoot();

// Crash records carry the raw Error, which may hold circular references (an
// Express error decorated with req/res is one). Rendering runs inside
// winston's crash handler, so it must never throw.
const renderMetadata = (metadata) => {
  try {
    return JSON.stringify(metadata);
  } catch {
    return '[unserializable metadata]';
  }
};

const logFormat = format.printf(
  (info) =>
    `${info.timestamp} [${packageJson.version}] [${info.level}]: ${info.message} ${
      Object.keys(info.metadata || {}).length > 0
        ? renderMetadata(info.metadata)
        : ''
    }`,
);

// Daily-rotate retention policy. 30 days of application logs at 20 MB per
// file caps disk usage at roughly 600 MB per logger version and gives
// operators enough history for offline triage; journalctl / pm2 / docker
// handle real-time tailing.
const MAX_LOG_FILE_SIZE = '20m';
const MAX_LOG_FILE_RETENTION = '30d';

/**
 * Remove log files from earlier CADT releases that are now superseded by the
 * rotated equivalents, so they don't accumulate unbounded on hosts upgrading
 * across versions.
 *
 *   error.log, combined.log                  -> superseded by application-%DATE%.log
 *   exceptions.log, rejections.log           -> superseded by application-%DATE%.log
 *   debug-%DATE%.log{,.gz,.N}                -> application-%DATE%.log now
 *                                               captures debug-level output
 *   exceptions-%DATE%.log, rejections-%DATE%.log
 *                                            -> deleted; crash records go to
 *                                               application-%DATE%.log from
 *                                               now on. These files were never
 *                                               written to, so no history is
 *                                               lost.
 *
 * Runs best-effort: missing files are ignored and per-file failures are
 * collected rather than thrown so a cleanup error never takes down startup.
 *
 * @param {string} logDir - Absolute path to the version-specific log directory.
 * @returns {{removed: string[], errors: string[]}}
 */
const cleanupObsoleteLogFiles = (logDir) => {
  const removed = [];
  const errors = [];

  if (!fs.existsSync(logDir)) {
    return { removed, errors };
  }

  const unbounded = [
    'error.log',
    'combined.log',
    'exceptions.log',
    'rejections.log',
  ];

  for (const name of unbounded) {
    const filePath = path.join(logDir, name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removed.push(name);
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  // Rotated files left behind by retired transports. Anchored to the
  // YYYY-MM-DD stamp those transports actually produced so an operator's own
  // exceptions-incident-copy.log is not caught by the sweep.
  const obsoletePattern =
    /^(debug|exceptions|rejections)-\d{4}-\d{2}-\d{2}\.log(\.\d+)?(\.gz)?$/;
  try {
    const entries = fs.readdirSync(logDir);
    for (const entry of entries) {
      if (obsoletePattern.test(entry)) {
        const filePath = path.join(logDir, entry);
        try {
          fs.unlinkSync(filePath);
          removed.push(entry);
        } catch (err) {
          errors.push(`${entry}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    errors.push(`readdir ${logDir}: ${err.message}`);
  }

  return { removed, errors };
};

/**
 * Create a logger instance for a specific version (v1 or v2)
 * @param {string} version - The version ('v1' or 'v2')
 * @returns {winston.Logger} Configured logger instance
 */
const createVersionLogger = (version) => {
  const logDir = `${chiaRoot}/cadt/${version}/logs`;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const legacyCleanup = cleanupObsoleteLogFiles(logDir);

  // Single rotated application log. Transport-level 'debug' makes this
  // capture the full debug+verbose+info+warn+error stream regardless of
  // APP.LOG_LEVEL, matching the behaviour of the previous debug-%DATE%.log
  // file that this transport replaces.
  const applicationTransport = new DailyRotateFile({
    filename: `${logDir}/application-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    level: 'debug',
    zippedArchive: true,
    maxSize: MAX_LOG_FILE_SIZE,
    maxFiles: MAX_LOG_FILE_RETENTION,
    utc: true,
    format: format.combine(format.json()),
  });

  // Uncaught exceptions and unhandled rejections land in the application log
  // rather than in dedicated files, so crash records sit in timeline order
  // alongside the requests that led to them. Registering a handler is also
  // what installs winston's process-level hooks, which combined with
  // exitOnError keeps the service alive across them.
  //
  // Set after construction on purpose: winston-daily-rotate-file names its
  // rotation audit after a hash of the constructor options, and the audit is
  // the only thing maxFiles prunes against. Passing these as options would
  // orphan the existing audit and strand every current log file on disk.
  applicationTransport.handleExceptions = true;
  applicationTransport.handleRejections = true;

  const versionLogger = createLogger({
    level: getConfig().APP.LOG_LEVEL || 'info',
    // No renderer at this level: every transport declares its own format.
    // A transport added without one writes `undefined` per line, since this
    // chain produces no rendered message.
    format: format.combine(
      redactSensitiveFields(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      // Winston's crash-routing flags. `exception` must stay top-level: it is
      // what lets a transport without handleExceptions skip crash records.
      // `rejection` is hoisted alongside it so both stay greppable in the
      // JSON output.
      format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'exception', 'rejection'],
      }),
    ),
    transports: [applicationTransport],
    exitOnError: false,
  });

  if (process.env.NODE_ENV !== 'production') {
    versionLogger.add(
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.prettyPrint(),
          logFormat,
        ),
        handleExceptions: true,
        handleRejections: true,
      }),
    );
  } else {
    // In production, also stream debug-level and above to stdout/stderr so
    // operators can consume the log stream via journalctl, pm2, or docker
    // alongside the on-disk log files. Errors go to stderr, everything
    // else to stdout.
    //
    // The explicit `level: 'debug'` is deliberate: winston 3 transport
    // levels are independent of the logger's level, and we want journalctl
    // to receive every "normal" log line (error through debug) regardless
    // of APP.LOG_LEVEL. The one level we deliberately exclude is `silly`,
    // which is reserved for extreme debugging (per-query Sequelize output
    // in src/config/config.js); operators who need that can flip the
    // transport to 'silly' temporarily.
    versionLogger.add(
      new transports.Console({
        level: 'debug',
        stderrLevels: ['error'],
        format: format.combine(format.json()),
        handleExceptions: true,
        handleRejections: true,
      }),
    );
  }

  if (legacyCleanup.removed.length > 0) {
    versionLogger.info(
      `Removed ${legacyCleanup.removed.length} obsolete log file(s) from ${logDir}: ${legacyCleanup.removed.join(', ')}`,
    );
  }
  if (legacyCleanup.errors.length > 0) {
    versionLogger.warn(
      `Could not remove some obsolete log files in ${logDir}: ${legacyCleanup.errors.join('; ')}`,
    );
  }

  return versionLogger;
};

// Create separate logger instances for V1 and V2
const logger = createVersionLogger('v1');
const loggerV2 = createVersionLogger('v2');

// Export both loggers
// logger is the default for V1 (maintains backward compatibility)
// loggerV2 is for V2 code
export { logger, loggerV2 };
