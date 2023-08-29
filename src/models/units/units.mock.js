import stub from './units.stub.js';

export const UnitMock = {
  findAll: ({ limit, offset }) =>
    stub.slice(offset * limit, (offset + 1) * limit),
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
