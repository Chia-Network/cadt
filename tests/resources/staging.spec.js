import app from '../../src/server';
import supertest from 'supertest';
import newProject from '../test-data/new-project.json' assert { type: 'json' };
import { pullPickListValues } from '../../src/utils/data-loaders';
import { expect } from 'chai';
import { prepareDb } from '../../src/database';
import datalayer from '../../src/datalayer';
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

describe('Staging Resource CRUD', function () {
  before(async function () {
    await pullPickListValues();
    await prepareDb();
  });

  beforeEach(async function () {
    await supertest(app).delete(`/v1/staging/clean`);
  });

  describe('GET - Find all Staging Records', function () {
    it('shows all commited and none committed staging records', async function () {
      await supertest(app).post('/v1/projects').send(newProject);

      const response = await supertest(app).get('/v1/staging');
      expect(response.body.length).to.equal(1);
    }).timeout(TEST_WAIT_TIME * 10);
    it('generates a diff object for the change', async function () {
      const responseCreate = await supertest(app)
        .post('/v1/projects')
        .send(newProject);

      const response = await supertest(app).get('/v1/staging');
      console.info('responseCreate.body[0]', responseCreate.body);
      console.info('response.body[0]', response.body[0]);
      expect(response.body[0].diff.original).to.deep.equal({});
      expect(
        response.body[0].diff.change[0].coBenefits[0].cobenefit,
      ).to.deep.equal(
        'Biodiversity through planting a variety of trees that are home to many native Singaporean species',
      );
    }).timeout(TEST_WAIT_TIME * 10);
  });

  describe('POST - Commit Records to datalayer', function () {
    it('Sends the staging table to the datalayer', function () {});
    it('Sets the committed flag to true when sent to the datalayer', function () {});
    it('Staging record is removed when Insert records propagate through the datalayer', function () {});
    it('Staging record is removed when Update records propagate through the datalayer', function () {});
    it('Staging record is removed when Delete records propagate through the datalayer', function () {});
    it('can commit just the project staging records optionally', async function () {
      await supertest(app).post('/v1/projects').send(newProject);
    });
    it('can commit just the unit staging records optionally', function () {});
  });

  describe('DELETE - Delete a single staging record', function () {
    it.skip('Removes the staging record from the staging table', async function () {
      await supertest(app).post('/v1/projects').send(newProject);
      await supertest(app).post('/v1/projects').send(newProject);
      await supertest(app).post('/v1/projects').send(newProject);
      const response = await supertest(app).get('/v1/staging');

      const deletedId = response.body[0].uuid;
      await supertest(app).delete(`/v1/staging`).send({ uuid: deletedId });
      const responseDeleted = await supertest(app).get('/v1/staging');
      // expect(responseDeleted.body.length).to.equal(2);
      expect(responseDeleted.body.find((r) => r.uuid === deletedId)).to.equal(
        undefined,
      );
    });
  });

  describe('DELETE - Clears the staging table', function () {
    it.skip('Clears the staging table', async function () {
      await supertest(app).delete('/v1/staging/clean');
      /// const response = await supertest(app).get('/v1/staging');
      // expect(response.body).to.deep.equal(0);
    });
  });

  describe('websocket', function () {
    it('flags a change when staging is updated', function () {});
  });
});
