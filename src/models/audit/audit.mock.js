import stub from './audit.stub.json' assert { type: 'json' };

export const AuditMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
