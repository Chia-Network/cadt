import { CONFIG } from '../user-config';
import { getDataModelVersion } from '../utils/helpers';
import { getChiaRoot } from 'chia-root-resolver';

const chiaRoot = getChiaRoot();

const persistanceFolder = `${chiaRoot}/carbon/cadt/${getDataModelVersion()}`;

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
    username: CONFIG().CADT.MIRROR_DB.DB_USERNAME || '',
    password: CONFIG().CADT.MIRROR_DB.DB_PASSWORD || '',
    database: CONFIG().CADT.MIRROR_DB.DB_NAME || '',
    host: CONFIG().CADT.MIRROR_DB.DB_HOST || '',
    dialect: 'mysql',
    logging: false,
  },
};
