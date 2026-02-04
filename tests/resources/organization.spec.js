import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { expect } from 'chai';
import { prepareDb } from '../../src/database';
import datalayer from '../../src/datalayer';
import { pullPickListValues } from '../../src/utils/data-loaders';
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;
import * as testFixtures from '../test-fixtures';
import { getHomeOrgId } from '../test-fixtures';

/**
 * Wait for organization to exist in database by polling
 * @param {string} orgName - Expected organization name
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} interval - Time between polls in ms
 * @returns {Promise<Object|null>} The organization or null
 */
const waitForOrgWithName = async (orgName, maxAttempts = 20, interval = 500) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const org = await Organization.findOne({ where: { name: orgName } });
    if (org) {
      return org;
    }
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  return null;
};

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

  describe('DELETE - Organization Parameter Validation', function () {
    it('rejects orgUid that is too short', async function () {
      const response = await supertest(app)
        .delete('/v1/organizations/abc123')
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
      expect(response.body.errors[0]).to.include('64-character hex string');
    });

    it('rejects orgUid that is too long', async function () {
      const tooLongOrgUid = 'a'.repeat(65);
      const response = await supertest(app)
        .delete(`/v1/organizations/${tooLongOrgUid}`)
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
      expect(response.body.errors[0]).to.include('64-character hex string');
    });

    it('rejects orgUid with non-hex characters', async function () {
      // 64 characters but contains non-hex chars (g, h, z)
      const invalidOrgUid = 'ghijklmnopqrstuvwxyz01234567890123456789012345678901234567890123';
      const response = await supertest(app)
        .delete(`/v1/organizations/${invalidOrgUid}`)
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
      expect(response.body.errors[0]).to.include('64-character hex string');
    });

    it('rejects orgUid with special characters', async function () {
      const response = await supertest(app)
        .delete('/v1/organizations/../../etc/passwd')
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
    });

    it('accepts valid 64-character hex orgUid format', async function () {
      // Valid format but org doesn't exist - should pass validation but fail on lookup
      const validOrgUid = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const response = await supertest(app)
        .delete(`/v1/organizations/${validOrgUid}`)
        .send();

      // Should NOT be a validation error (400 with "64-character hex string")
      // Instead should be a "not found" type error since the org doesn't exist
      if (response.status === 400) {
        expect(response.body.errors?.[0] || '').to.not.include('64-character hex string');
        expect(response.body.message).to.include('does not exist');
      }
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
      });

      expect(response.body.message).to.equal(
        'New organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.',
      );

      // Wait for org creation to complete (v1 creation is now async)
      const createdOrg = await waitForOrgWithName('My Org');
      expect(createdOrg).to.not.be.null;
    }).timeout(TEST_WAIT_TIME * 10);

    it('Organization can be retreived from datalayer', async function () {
      // Wait for org to exist (in case previous test's async creation is still running)
      await waitForOrgWithName('My Org');

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
