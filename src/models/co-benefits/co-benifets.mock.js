import stub from './co-benifets.stub.json';

export const CoBenifetsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
