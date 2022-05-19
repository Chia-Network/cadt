const _ = require('lodash');
const winston = require('winston');
const { format, transports, createLogger } = winston;
const yaml = require('js-yaml');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const fs = require('fs');
const os = require('os');
const homeDir = os.homedir();

const fileLoader = _.memoize((filepath) => {
  console.log(`Reading file at ${filepath}`);

  const file = path.resolve(filepath);

  try {
    return yaml.load(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`File not found at ${file}`, e);
  }
});

const getDataModelVersion = () => {
  const packageJson = fileLoader('package.json');
  const version = packageJson.version;
  const majorVersion = version.split('.')[0];
  return `v${majorVersion}`;
};



const logDir = `${homeDir}/.chia/climate-warehouse/${getDataModelVersion()}/logs`;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFormat = format.printf(
  (info) =>
    `${info.timestamp} [${info.level}]: ${info.message} ${
      Object.keys(info.metadata || {}).length > 0
        ? JSON.stringify(info.metadata)
        : ''
    }`,
);

const logger = createLogger({
  level: 'info',
  format: format.combine(
    logFormat,
    // format.label({ label: path.basename(process.main.filename) }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  ),
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new transports.File({
      filename: `${logDir}/error.log`,
      level: 'error',
      format: format.combine(format.json()),
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({
      filename: `${logDir}/combined.log`,
      format: format.combine(format.json()),
    }),
    // Rotate logs to `application-%DATE%.log`
    new DailyRotateFile({
      filename: `${logDir}/application-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
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

//
// If not in production then log to the `console`
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.prettyPrint(),
        logFormat,
      ),
    }),
  );
}

module.exports = {
  logger,
};
