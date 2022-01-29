import stub from './estimations.modeltypes.cjs';

export const EstimationMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
