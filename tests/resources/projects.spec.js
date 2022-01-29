// import chai from 'chai';
import supertest from 'supertest';
import app from '../../src/server';

// const { expect } = chai;

describe.skip('Project Resource CRUD', function () {
  it('gets all the projects available', async function () {
    await supertest(app).get('/v1/projects').expect(200);
  }).timeout(50000);
});
