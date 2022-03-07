import writeService from './writeService';
import syncService from './syncService';
import wallet from './wallet';

export default {
  ...writeService,
  ...syncService,
  ...wallet,
};
