const SQLITE_PRAGMAS = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA synchronous = NORMAL',
  'PRAGMA cache_size = -65536',
  'PRAGMA temp_store = MEMORY',
  'PRAGMA mmap_size = 268435456',
  // busy_timeout is per-connection: SQLite waits up to this many ms for a
  // write lock before returning SQLITE_BUSY. Sequelize's sqlite dialect does
  // not honour dialectOptions.busyTimeout, so it must be set on every pooled
  // connection here - otherwise only the single connection touched at startup
  // gets it and the rest fail immediately under concurrent writes.
  'PRAGMA busy_timeout = 30000',
];

const applySqlitePragmas = async (connection) => {
  if (!connection || typeof connection.exec !== 'function') {
    return;
  }

  await new Promise((resolve, reject) => {
    connection.exec(SQLITE_PRAGMAS.join('; '), (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

export const installSqlitePragmas = (sequelize, pragmaLogger = console) => {
  if (sequelize.getDialect() !== 'sqlite') {
    return;
  }

  const configuredConnections = new WeakSet();
  const { connectionManager } = sequelize;
  const getConnection = connectionManager.getConnection.bind(connectionManager);

  connectionManager.getConnection = async (...args) => {
    const connection = await getConnection(...args);

    if (!configuredConnections.has(connection)) {
      try {
        await applySqlitePragmas(connection);
        configuredConnections.add(connection);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pragmaLogger.warn(`Could not apply SQLite PRAGMAs: ${message}`);
      }
    }

    return connection;
  };
};
