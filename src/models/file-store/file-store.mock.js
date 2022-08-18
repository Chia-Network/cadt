import stub from './file-store.stub.json';

export const FileStoreMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
