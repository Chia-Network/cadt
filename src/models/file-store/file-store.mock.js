import stub from './file-store.stub.js';

export const FileStoreMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
