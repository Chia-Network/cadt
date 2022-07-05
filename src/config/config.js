import { getConfig } from '../utils/config-loader';
import { getDataModelVersion } from '../utils/helpers';
import os from 'os';

const homeDir = os.homedir();

const persistanceFolder = `${homeDir}/.chia/climate-warehouse/${getDataModelVersion()}`;

export default {
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
