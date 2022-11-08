import stub from './units.stub.json';

export const UnitMock = {
  findAll: ({ limit, offset }) => stub.slice(offset * limit, (offset + 1) * limit),
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
