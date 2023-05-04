const winston = require('winston');
const { format, transports, createLogger } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');

const fs = require('fs');
const os = require('os');
const path = require('path');
const packageJson = require('../../package.json');

const getChiaRoot = () => {
  let chiaRoot;

  if(process.env.CHIA_ROOT) {
    chiaRoot = path.resolve(process.env.CHIA_ROOT);
  } else {
    const homeDir = os.homedir();
    chiaRoot = path.resolve(`${homeDir}/.chia/mainnet`);
  }

  return chiaRoot;
};

const chiaRoot = getChiaRoot();

const getDataModelVersion = () => {
  const version = packageJson.version;
  const majorVersion = version.split('.')[0];
  return `v${majorVersion}`;
};

const logDir = `${chiaRoot}/cadt/${getDataModelVersion()}/logs`;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFormat = format.printf(
  (info) =>
    `${info.timestamp} [${packageJson.version}] [${info.level}]: ${info.message} ${
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
