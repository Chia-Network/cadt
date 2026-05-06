const SQLITE_PRAGMAS = [
  'PRAGMA synchronous = NORMAL',
  'PRAGMA cache_size = -65536',
  'PRAGMA temp_store = MEMORY',
  'PRAGMA mmap_size = 268435456',
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

export const installSqlitePragmas = (sequelize) => {
  if (sequelize.getDialect() !== 'sqlite') {
    return;
  }

  const configuredConnections = new WeakSet();
  const { connectionManager } = sequelize;
  const getConnection = connectionManager.getConnection.bind(connectionManager);

  connectionManager.getConnection = async (...args) => {
    const connection = await getConnection(...args);

    if (!configuredConnections.has(connection)) {
      await applySqlitePragmas(connection);
      configuredConnections.add(connection);
    }

    return connection;
  };
};
