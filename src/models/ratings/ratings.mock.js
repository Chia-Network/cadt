import stub from './ratings.stub.json' assert { type: 'json' };

export const RatingMock = {
  findAll: () => stub,
  findOne: (id) => {
    return stub.find((record) => record.id == id);
  },
};
