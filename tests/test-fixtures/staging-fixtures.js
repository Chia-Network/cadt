import _ from 'lodash';

import chai from 'chai';
const { expect } = chai;
import supertest from 'supertest';

import app from '../../src/server';

export const resetStagingTable = () => {
  return supertest(app).get(`/v1/staging/clean`);
};

export const getLastCreatedStagingRecord = async () => {
  const stagingRes = await supertest(app).get('/v1/staging');
  return _.last(stagingRes.body);
};

export const commitStagingRecords = async () => {
  const results = await supertest(app).post('/v1/staging/commit');

  expect(results.statusCode).to.equal(200);
  expect(results.body).to.deep.equal({
    message: 'Staging Table committed to full node',
  });

  return results;
};
