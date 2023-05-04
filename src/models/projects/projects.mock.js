import stub from './projects.stub.json' assert { type: 'json' };

export const ProjectMock = {
  findAll: ({ limit, offset }) =>
    stub.slice(offset * limit, (offset + 1) * limit),
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
