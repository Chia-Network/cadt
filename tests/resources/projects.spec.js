// import chai from 'chai';
import supertest from 'supertest';
import app from '../../src/server';

// const { expect } = chai;

describe('Project Resource CRUD', () => {
  it('gets all the projects available', async () => {
    await supertest(app).get('/v1/projects').expect(200);
  });
});
