import stub from './governance.stub.json' assert { type: 'json' };

export const GovernanceMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
