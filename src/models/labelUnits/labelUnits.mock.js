import stub from './labelUnits.stub.js';

export const LabelUnitsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
