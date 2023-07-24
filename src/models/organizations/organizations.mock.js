import stub from './organizations.stub.js';

export const OrganizationMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
