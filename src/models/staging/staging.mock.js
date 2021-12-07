import stub from './related-projects.stub.json';

export const RelatedProjectMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
