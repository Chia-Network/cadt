import stub from './labels.stub.json' assert { type: 'json' };

export const LabelsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
