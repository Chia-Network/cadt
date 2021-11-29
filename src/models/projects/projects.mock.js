import stub from './projects.stub.json';

export const ProjectMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
