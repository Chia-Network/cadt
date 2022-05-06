import supertest from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';

import { Organization } from '../../src/models';
import app from '../../src/server';
import * as testFixtures from '../test-fixtures';
import datalayer from '../../src/datalayer';
import { prepareDb } from '../../src/database';
import newUnit from '../test-data/new-unit.json';
import { pullPickListValues } from '../../src/utils/data-loaders';
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

describe('Units Resource CRUD', function () {
  before(async function () {
    await pullPickListValues();
    await prepareDb();
  });

  describe('GET Units', function () {
    describe('error states', function () {
      it('errors if there if there is no connection to the datalayer', function () {});
    });

    describe('success states', function () {
      let response;
      beforeEach(async function () {
        await testFixtures.createTestHomeOrg();
        await testFixtures.getHomeOrgId();
        await testFixtures.createNewUnit();
        await testFixtures.commitStagingRecords();
        await testFixtures.waitForDataLayerSync();
        const result = await supertest(app).get('/v1/units');
        response = result.body[0];
      });

      afterEach(async function () {
        await supertest(app).delete('/v1/units').send({
          warehouseUnitId: newUnit.warehouseUnitId,
        });
        await supertest(app).post('/v1/staging/commit');
      });

      it('gets all the units available', async function () {
        // no query params
        const result = await supertest(app).get('/v1/units').query({});

        expect(result.body.length).to.not.equal(0);
      }).timeout(TEST_WAIT_TIME * 10);
      it('gets all the units filtered by orgUid', async function () {
        const result = await supertest(app)
          .get('/v1/units')
          .query({ orgUid: response.orgUid });

        expect(result.body.length).to.not.equal(1);
        // ?orgUid=XXXX
      }).timeout(TEST_WAIT_TIME * 10);
      it('gets all the units for a search term', async function () {
        // ?search=XXXX
        const result = await supertest(app)
          .get('/v1/units')
          .query({ search: 'Certification' });

        expect(result.body.length).to.not.equal(1);
      }).timeout(TEST_WAIT_TIME * 10);
      it('gets all the units for a search term filtered by orgUid', async function () {
        // ?orgUid=XXXX&search=XXXX
        const result = await supertest(app)
          .get('/v1/units')
          .query({ orgUid: response.orgUid, search: 'Certification' });

        expect(result.body.length).to.not.equal(1);
      }).timeout(TEST_WAIT_TIME * 10);
      it('gets optional paginated results', async function () {
        // ?page=X&limit=10
        const result = await supertest(app)
          .get('/v1/units')
          .query({ page: 1, limit: 1 });

        expect(result.body.length).to.not.equal(1);
      }).timeout(TEST_WAIT_TIME * 10);
      it('finds a single result by warehouseUnitId', async function () {
        // ?warehouseUnitId=XXXX
        const result = await supertest(app)
          .get('/v1/units')
          .query({ warehouseUnitId: response.warehouseUnitId, limit: 1 });

        expect(result.body.length).to.not.equal(1);
      }).timeout(TEST_WAIT_TIME * 10);
    });
  });

  describe('POST Units - Create', function () {
    describe('error states', function () {
      it('errors if no home organization exists', async function () {
        await Organization.destroy({
          where: {},
          truncate: true,
        });

        const responsePost = await supertest(app)
          .post('/v1/units')
          .send(newUnit);
        expect(responsePost.statusCode).to.equal(400);
        expect(responsePost.body.error).to.equal(
          'No Home organization found, please create an organization to write data',
        );
      }).timeout(TEST_WAIT_TIME * 10);
      it('errors if there is a current set of pending commits', async function () {});
      it('errors if there if there is no connection to the datalayer', async function () {
        await testFixtures.createTestHomeOrg();
        sinon.stub(datalayer, 'dataLayerAvailable').resolves(false);
        const responsePost = await supertest(app)
          .post('/v1/units')
          .send(newUnit);

        expect(responsePost.statusCode).to.equal(400);
        expect(responsePost.body.error).to.equal(
          'Can not establish connection to Chia Datalayer',
        );
      }).timeout(TEST_WAIT_TIME * 10);
    });

    describe.skip('success states', function () {
      it('creates a new unit with no child tables', async function () {
        await testFixtures.createTestHomeOrg();
        await testFixtures.createNewUnit(newUnit);
      });

      it('creates a new unit with all child tables', async function () {
        await testFixtures.createTestHomeOrg();
        const payload = newUnit;
        delete payload.labels;
        delete payload.issuances;

        await testFixtures.createNewUnit(payload);
      });
    });
  });

  describe('PUT Units - Update', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
      it('errors if the warehouseUnitId is not in the payload', function () {});
      it('errors if the warehouseUnitId is an existing record', function () {});
      it('errors if trying to update a child table that is not an existing record', function () {});
      it('errors if the orgUid of the unit does not equal the home organization', function () {});
    });

    describe('success states', function () {
      it('updates a new unit with no child tables', function () {});
      it('updates a new unit with all child tables', function () {});
    });
  });

  describe('DELETE Units - Delete', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
      it('errors if the warehouseUnitId is not in the payload', function () {});
      it('errors if the warehouseUnitId is an existing record', function () {});
      it('errors if the orgUid of the unit does not equal the home organization', function () {});
    });

    describe('success states', function () {
      it('updates a new unit with no child tables', function () {});
      it('updates a new unit with all child tables', function () {});
    });
  });

  describe('PUT - Split Units', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
      it('errors if the orgUid of the unit does not equal the home organization', function () {});
      it('errors if the unit split does not add up correctly', function () {});
    });

    describe('success states', function () {
      it('properly splits the unit', function () {});
    });
  });

  describe('websocket', function () {
    it('flags a change when units are updated', function () {});
  });
});
