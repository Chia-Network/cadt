import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/index.js';
import { expect } from 'chai';
import { prepareDb } from '../../src/database';
import datalayer from '../../src/datalayer';
import { pullPickListValues } from '../../src/utils/data-loaders';
import { getHomeOrgId } from '../test-fixtures';

const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;
import * as testFixtures from '../test-fixtures';

describe('Orgainzation Resource CRUD', function () {
  before(async function () {
    await pullPickListValues();
    await prepareDb();
  });

  beforeEach(async function () {
    await testFixtures.createTestHomeOrg();
  });

  describe('DELETE - Reset Organization', function () {
    it('clears the home org and any staging data', async function () {
      // add a project to the staging table
      await testFixtures.createNewProject();

      const homeOrgUid = await getHomeOrgId();
      const response = await supertest(app)
        .delete(`/v1/organizations/${homeOrgUid}`)
        .send();
      const body = response.body;

      expect(body.message).to.equal(
        'Your home organization was deleted from this instance. cadt will no longer sync its data. (note that this org still exists in datalayer)',
      );

      const stagingData = await testFixtures.getLastCreatedStagingRecord();
      expect(stagingData).to.be.undefined;
    });
  });

  describe('POST - Creates an organization', function () {
    it('Creates an organization', async function () {
      await Organization.destroy({
        where: {},
        truncate: true,
      });

      const response = await supertest(app).post(`/v1/organizations`).send({
        name: 'My Org',
        icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
        prefix: 'test',
      });

      expect(response.body.message).to.equal(
        'New organization created successfully.',
      );
    }).timeout(TEST_WAIT_TIME * 10);

    it('Organization can be retreived from datalayer', async function () {
      const response = await supertest(app).get(`/v1/organizations`).send();

      expect(Object.values(response.body)[0].name).to.equal('My Org');
      expect(Object.values(response.body)[0].icon).to.equal(
        'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
      );
    }).timeout(TEST_WAIT_TIME * 10);
  });

  describe('PUT - Resyncs an organization', function () {
    it('resyncs organization', async function () {
      // add a project to the staging table
      await testFixtures.createNewProject();

      const homeOrgUid = await getHomeOrgId();
      const response = await supertest(app)
        .put(`/v1/organizations/resync`)
        .send({
          orgUid: homeOrgUid,
        });

      expect(response.body.message).to.equal(
        'Resyncing organization process initiated',
      );
    }).timeout(TEST_WAIT_TIME * 10);
  });
});
