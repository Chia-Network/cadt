import writeService from './writeService';
import syncService from './syncService';
import wallet from './wallet';
import fullNode from './fullNode';

export default {
  ...writeService,
  ...syncService,
  ...wallet,
  ...fullNode,
};
