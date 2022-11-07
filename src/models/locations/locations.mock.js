import stub from './locations.stub.json' assert { type: 'json' };

export const LocationMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
