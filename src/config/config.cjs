require('dotenv').config();

module.exports = {
  local: {
    dialect: 'sqlite',
    storage: './data.sqlite3',
  },
  test: {
    dialect: 'sqlite',
    storage: './test.sqlite3',
  },
  mirrorTest: {
    dialect: 'sqlite',
    storage: './testMirror.sqlite3',
  },
  mirror: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql',
  },
};
