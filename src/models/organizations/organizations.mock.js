import stub from './organizations.stub.json';

export const OrganizationMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
