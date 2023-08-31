import _ from 'lodash';

import os from 'os';
import path from 'path';

export const getChiaRoot = _.memoize(() => {
  let chiaRoot;

  if (process.env.CHIA_ROOT) {
    chiaRoot = path.resolve(process.env.CHIA_ROOT);
  } else {
    const homeDir = os.homedir();
    chiaRoot = path.resolve(`${homeDir}/.chia/mainnet`);
  }

  return chiaRoot;
});
