import stub from './meta.stub.json' assert { type: 'json' };

export const MetaMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
