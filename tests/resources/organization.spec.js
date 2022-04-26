import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { expect } from 'chai';
import { prepareDb } from '../../src/database';
import datalayer from '../../src/datalayer';
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

const orgName = Math.random().toString();
describe('Orgainzation Resource CRUD', function () {
  before(async function () {
    await prepareDb();
  });

  describe('POST - Creates an organization', function () {
    it('Creates an organization', async function () {
      await Organization.destroy({
        where: {},
        truncate: true,
      });

      const response = await supertest(app).post(`/v1/organizations`).send({
        name: orgName,
        file: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
      });

      expect(response.body.message).to.equal(
        'New organization created successfully.',
      );
    }).timeout(TEST_WAIT_TIME * 10);
    it('Organization can be retreived from datalayer', async function () {
      const response = await supertest(app).get(`/v1/organizations`).send();

      expect(Object.values(response.body)[0].name).to.equal(orgName);
      expect(Object.values(response.body)[0].file).to.equal(
        'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
      );
    }).timeout(TEST_WAIT_TIME * 10);
  });
});
