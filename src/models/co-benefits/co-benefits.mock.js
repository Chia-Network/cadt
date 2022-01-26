import stub from './co-benefits.stub.json';

export const CoBenefitsMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
