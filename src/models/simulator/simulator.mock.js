import stub from './simulator.stub.json';

export const SimulatorMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
