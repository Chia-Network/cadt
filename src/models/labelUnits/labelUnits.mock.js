import stub from './labelUnits.stub.json' assert { type: 'json' };

export const LabelUnitsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
