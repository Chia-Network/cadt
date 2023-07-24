import stub from './governance.stub.js';

export const GovernanceMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
