require('dotenv').config();
const fs = require('fs');

// This is a workaround for running the binary from the UI on MacOS
//
// CWD in that case ends up being $HOME instead of $HOME/ClimateWarehouse, and relative paths and library includes
// don't work in that case. Detecting this common case (by checking if the ClimateWarehouse/data.sqlite3 db exists)
// and then changing the CWD to the actual ClimateWarehouse directory allows it to run launched from the UI or in
// from $HOME or the actual directory in terminal
try {
  fs.accessSync('./ClimateWarehouse/data.sqlite3');
  process.chdir('./ClimateWarehouse');
} catch (err) {}

module.exports = {
  local: {
    dialect: 'sqlite',
    storage: './data.sqlite3',
    logging: false,
  },
  simulator: {
    dialect: 'sqlite',
    storage: './simulator.sqlite3',
    logging: false,
  },
  test: {
    dialect: 'sqlite',
    storage: './test.sqlite3',
    logging: false,
  },
  mirrorTest: {
    dialect: 'sqlite',
    storage: './testMirror.sqlite3',
    logging: false,
  },
  mirror: {
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    host: process.env.DB_HOST || '',
    dialect: 'mysql',
    logging: false,
  },
};
