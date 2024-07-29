import _ from 'lodash';

import { expect } from 'chai';
import supertest from 'supertest';

import app from '../../src/server.js';

export const resetStagingTable = async () => {
  await supertest(app).delete(`/v1/staging/clean`);
  const result = await supertest(app).get('/v1/staging');
  expect(result.body).to.deep.equal([]);
};

export const getLastCreatedStagingRecord = async () => {
  const result = await supertest(app).get('/v1/staging');
  expect(result.body).to.be.an('array');
  return _.last(result.body);
};

export const commitStagingRecords = async () => {
  const results = await supertest(app).post('/v1/staging/commit');

  expect(results.statusCode).to.equal(200);
  expect(results.body).to.deep.equal({
    message: 'Staging Table committed to full node',
    success: true,
  });

  return results;
};
