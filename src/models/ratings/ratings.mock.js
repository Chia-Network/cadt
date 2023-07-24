import stub from './ratings.stub.js';

export const RatingMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
