import stub from './issuances.stub.json' assert { type: 'json' };

export const IssuanceMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
