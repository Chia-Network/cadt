import chai from 'chai';
const { expect } = chai;

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

export const objectContainsSubSet = (obj, objSubset) => {
  Object.keys(objSubset).forEach((key) => {
    if (Array.isArray(objSubset[key])) {
      objSubset[key].forEach((childRecord, index) => {
        Object.keys(childRecord).forEach((childkey) => {
          expect(obj[key][index][childkey], childkey).to.deep.equal(
            objSubset[key][index][childkey],
          );
        });
      });
    } else if (Object.keys(objSubset[key]).length) {
      Object.keys(objSubset[key]).forEach((childkey) => {
        expect(obj[key][childkey], childkey).to.deep.equal(
          objSubset[key][childkey],
        );
      });
    } else {
      expect(
        objSubset[key],
        `{${key}: ${objSubset[key]}} does not equal {${key}: ${obj[key]}}`,
      ).to.deep.equal(obj[key]);
    }
  });
};
