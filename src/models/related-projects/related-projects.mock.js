import stub from './related-projects.stub.json' assert { type: 'json' };

export const RelatedProjectMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
