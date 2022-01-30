import { POLLING_INTERVAL } from '../../src/fullnode';
const TEST_WAIT_TIME = POLLING_INTERVAL * 2;

// The node simulator runs on an async process, we are importing
// the WAIT_TIME constant from the simulator, padding it and waiting for the
// appropriate amount of time for the simulator to finish its operations
export const waitForDataLayerSync = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, TEST_WAIT_TIME * 2);
  });
};
