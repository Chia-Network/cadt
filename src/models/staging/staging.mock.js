import stub from './staging.stub.json' assert { type: 'json' };

export const StagingMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
