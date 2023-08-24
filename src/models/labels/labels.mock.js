import stub from './labels.stub.js';

export const LabelsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
