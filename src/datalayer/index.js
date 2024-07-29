import writeService from './writeService.js';
import syncService from './syncService.js';
import wallet from './wallet.js';
import fullNode from './fullNode.js';

export default {
  ...writeService,
  ...syncService,
  ...wallet,
  ...fullNode,
};
