import stub from './projects.stub.js';

export const ProjectMock = {
  findAll: ({ limit, offset }) =>
    stub.slice(offset * limit, (offset + 1) * limit),
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
