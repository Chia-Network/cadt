import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import os from 'os';
import path from 'path';
import packageJson from '../../package.json' with { type: 'json' };
import { getConfig } from '../utils/config-loader.js';

const { format, transports, createLogger } = winston;

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

const logFormat = format.printf(
  (info) =>
    `${info.timestamp} [${packageJson.version}] [${info.level}]: ${info.message} ${
      Object.keys(info.metadata || {}).length > 0
        ? JSON.stringify(info.metadata)
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
 *   error.log, combined.log                  -> merged into application-%DATE%.log
 *   exceptions.log, rejections.log           -> merged into their rotated siblings
 *   debug-%DATE%.log{,.gz,.N}                -> application-%DATE%.log now
 *                                               captures debug-level output
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

  // Orphaned debug-%DATE%.log{,.N,.gz} files from the retired debug transport.
  const debugPattern = /^debug-.*\.log(\.\d+)?(\.gz)?$/;
  try {
    const entries = fs.readdirSync(logDir);
    for (const entry of entries) {
      if (debugPattern.test(entry)) {
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

  const versionLogger = createLogger({
    level: getConfig().APP.LOG_LEVEL || 'info',
    format: format.combine(
      logFormat,
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    ),
    transports: [
      // Single rotated application log. Transport-level 'debug' makes this
      // capture the full debug+verbose+info+warn+error stream regardless of
      // APP.LOG_LEVEL, matching the behaviour of the previous
      // debug-%DATE%.log file that this transport replaces.
      new DailyRotateFile({
        filename: `${logDir}/application-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'debug',
        zippedArchive: true,
        maxSize: MAX_LOG_FILE_SIZE,
        maxFiles: MAX_LOG_FILE_RETENTION,
        utc: true,
        format: format.combine(format.json()),
      }),
    ],
    exceptionHandlers: [
      new DailyRotateFile({
        filename: `${logDir}/exceptions-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: MAX_LOG_FILE_SIZE,
        maxFiles: MAX_LOG_FILE_RETENTION,
        utc: true,
      }),
    ],
    rejectionHandlers: [
      new DailyRotateFile({
        filename: `${logDir}/rejections-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: MAX_LOG_FILE_SIZE,
        maxFiles: MAX_LOG_FILE_RETENTION,
        utc: true,
      }),
    ],
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
