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

  const versionLogger = createLogger({
    level: getConfig().APP.LOG_LEVEL || 'info',
    format: format.combine(
      logFormat,
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    ),
    transports: [
      new transports.File({
        filename: `${logDir}/error.log`,
        level: 'error',
        format: format.combine(format.json()),
      }),
      new transports.File({
        filename: `${logDir}/combined.log`,
        format: format.combine(format.json()),
      }),
      new DailyRotateFile({
        filename: `${logDir}/application-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        utc: true,
        format: format.combine(format.json()),
      }),
      new DailyRotateFile({
        filename: `${logDir}/debug-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'debug',
        zippedArchive: true,
        maxSize: '20m',
        utc: true,
        format: format.combine(format.json()),
      }),
    ],
    exceptionHandlers: [
      new transports.File({
        filename: `${logDir}/exceptions.log`,
      }),
      new DailyRotateFile({
        filename: `${logDir}/exceptions-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        utc: true,
      }),
    ],
    rejectionHandlers: [
      new transports.File({
        filename: `${logDir}/rejections.log`,
      }),
      new DailyRotateFile({
        filename: `${logDir}/rejections-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
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
  } else {
    // In production, also stream every log line the logger emits to the
    // process's stdout/stderr so operators can consume them via journalctl,
    // pm2, or docker. File transports above continue to hold the same data
    // on disk. Errors go to stderr, everything else to stdout.
    versionLogger.add(
      new transports.Console({
        stderrLevels: ['error'],
        format: format.combine(format.json()),
      }),
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
