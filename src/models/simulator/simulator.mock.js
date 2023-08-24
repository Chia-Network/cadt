import stub from './simulator.stub.js';

export const SimulatorMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
