import stub from './organizations.stub.json';

export const CoBenefitsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
