import stub from './qualificationUnits.stub.json';

export const QualificationMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
