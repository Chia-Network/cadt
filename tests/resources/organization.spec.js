import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { expect } from 'chai';
const orgName = Math.random().toString();
describe('Orgainzation Resource CRUD', function () {
  describe('POST - Creates an organization', function () {
    it('Creates an organization', async function () {
      await Organization.destroy({
        where: {},
        truncate: true,
      });

      const response = await supertest(app).post(`/v1/organizations`).send({
        name: orgName,
        icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
      });

      expect(response.body.message).to.equal(
        'New organization created successfully.',
      );
    });
    it('Organization can be retreived from datalayer', async function () {
      const response = await supertest(app).get(`/v1/organizations`).send();

      expect(Object.values(response.body)[0].name).to.equal(orgName);
      expect(Object.values(response.body)[0].icon).to.equal(
        'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
      );
    });
  });
});
