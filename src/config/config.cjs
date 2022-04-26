require('dotenv').config();

const _ = require('lodash');
const yaml = require('js-yaml');
const fs = require('fs');
const os = require('os');
const path = require('path');
const homeDir = os.homedir();
const defaultConfig = require('../utils/defaultConfig.json');

const persistanceFolder = `${homeDir}/.chia/climate-warehouse`;

// Adding this duplicate function here because im having trouble
// importing it in from utils folder
const getConfig = _.memoize(() => {
  const configFile = path.resolve(
    `${homeDir}/.chia/climate-warehouse/config.yaml`,
  );

  // First write it to chia home
  if (!fs.existsSync(configFile)) {
    try {
      fs.writeFileSync(configFile, yaml.dump(defaultConfig), 'utf8');
    } catch (err) {
      // if it still doesnt exist that means we are in an env without write permissions
      // so just load the default en
      if (typeof process.env.USE_SIMULATOR === 'string') {
        defaultConfig.APP.USE_SIMULATOR = true;
      }

      console.log('Cant write config file, falling back to defaults');
      return yaml.load(yaml.dump(defaultConfig));
    }
  }

  try {
    const yml = yaml.load(fs.readFileSync(configFile, 'utf8'));

    if (typeof process.env.USE_SIMULATOR === 'string') {
      yml.APP.USE_SIMULATOR = true;
    }

    return yml;
  } catch (e) {
    console.log(e, `Config file not found at ${configFile}`);
  }
});

module.exports = {
  local: {
    dialect: 'sqlite',
    storage: `${persistanceFolder}/data.sqlite3`,
    logging: false,
  },
  simulator: {
    dialect: 'sqlite',
    storage: `${persistanceFolder}/simulator.sqlite3`,
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
    username: getConfig().MIRROR_DB.DB_USERNAME || '',
    password: getConfig().MIRROR_DB.DB_PASSWORD || '',
    database: getConfig().MIRROR_DB.DB_NAME || '',
    host: getConfig().MIRROR_DB.DB_HOST || '',
    dialect: 'mysql',
    logging: false,
  },
};
