'use strict';

const ready = {
  v1: false,
  v2: false,
};

export const markGovernanceReady = (version) => {
  if (Object.prototype.hasOwnProperty.call(ready, version)) {
    ready[version] = true;
  }
};

export const markGovernanceNotReady = (version) => {
  if (Object.prototype.hasOwnProperty.call(ready, version)) {
    ready[version] = false;
  }
};

export const isGovernanceReady = (version) => ready[version] === true;

export const resetGovernanceReadiness = () => {
  ready.v1 = false;
  ready.v2 = false;
};
