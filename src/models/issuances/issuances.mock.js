import stub from './issuances.stub.js';

export const IssuanceMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
