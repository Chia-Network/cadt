import stub from './vintages.stub.json';

export const VintageMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
