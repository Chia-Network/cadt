import stub from './meta.stub.json';

export const MetaMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
