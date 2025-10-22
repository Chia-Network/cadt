import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { pullPickListValues } from '../../../src/utils/data-loaders';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  cleanupV2TestData,
  getV2TestTimeout,
  setV2MetaValue,
  getV2MetaValue,
} from '../test-fixtures';

describe('V2 System Table Tests', function () {
  let homeOrgUid;

  before(async function () {
    await pullPickListValues();
    await prepareV2Db();
    homeOrgUid = await createV2TestHomeOrg();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('Organizations V2 System Table', function () {
    it('retrieves organizations successfully', async function () {
      const response = await supertest(app).get('/v2/organizations');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    }).timeout(getV2TestTimeout());

    it('retrieves home organization', async function () {
      const response = await supertest(app).get('/v2/organizations');

      expect(response.status).to.equal(200);
      const homeOrg = response.body.find(org => org.isHome === true);
      expect(homeOrg).to.be.ok;
      expect(homeOrg.orgUid).to.equal(homeOrgUid);
    }).timeout(getV2TestTimeout());

    it('filters organizations by subscription status', async function () {
      const response = await supertest(app)
        .get('/v2/organizations')
        .query({ subscribed: true });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      response.body.forEach(org => {
        expect(org.subscribed).to.equal(true);
      });
    }).timeout(getV2TestTimeout());

    it('updates organization successfully', async function () {
      const updateData = {
        name: 'Updated V2 Organization Name',
        icon: 'updated-icon',
      };

      const response = await supertest(app)
        .put(`/v2/organizations/${homeOrgUid}`)
        .send(updateData);

      validateV2SuccessResponse(response, 'Organization updated successfully');
    }).timeout(getV2TestTimeout());

    it('validates organization data structure', async function () {
      const response = await supertest(app).get('/v2/organizations');

      expect(response.status).to.equal(200);
      const homeOrg = response.body.find(org => org.isHome === true);

      expect(homeOrg).to.have.property('orgUid');
      expect(homeOrg).to.have.property('name');
      expect(homeOrg).to.have.property('icon');
      expect(homeOrg).to.have.property('registryId');
      expect(homeOrg).to.have.property('subscribed');
      expect(homeOrg).to.have.property('synced');
      expect(homeOrg).to.have.property('isHome');
      expect(homeOrg).to.have.property('created_at');
      expect(homeOrg).to.have.property('updated_at');
    }).timeout(getV2TestTimeout());
  });

  describe('Meta V2 System Table', function () {
    it('sets and retrieves meta values', async function () {
      const testKey = 'v2-test-key';
      const testValue = 'v2-test-value';

      // Set meta value
      const setResponse = await supertest(app)
        .post('/v2/meta')
        .send({
          metaKey: testKey,
          metaValue: testValue,
        });

      validateV2SuccessResponse(setResponse, 'Meta value set successfully');

      // Retrieve meta value
      const getResponse = await supertest(app)
        .get(`/v2/meta/${testKey}`);

      expect(getResponse.status).to.equal(200);
      expect(getResponse.body).to.have.property('metaValue', testValue);
    }).timeout(getV2TestTimeout());

    it('updates existing meta values', async function () {
      const testKey = 'v2-test-update-key';
      const initialValue = 'initial-value';
      const updatedValue = 'updated-value';

      // Set initial value
      await supertest(app)
        .post('/v2/meta')
        .send({
          metaKey: testKey,
          metaValue: initialValue,
        });

      // Update value
      const updateResponse = await supertest(app)
        .put(`/v2/meta/${testKey}`)
        .send({
          metaValue: updatedValue,
        });

      validateV2SuccessResponse(updateResponse, 'Meta value updated successfully');

      // Verify update
      const getResponse = await supertest(app)
        .get(`/v2/meta/${testKey}`);

      expect(getResponse.status).to.equal(200);
      expect(getResponse.body).to.have.property('metaValue', updatedValue);
    }).timeout(getV2TestTimeout());

    it('deletes meta values', async function () {
      const testKey = 'v2-test-delete-key';
      const testValue = 'v2-test-delete-value';

      // Set meta value
      await supertest(app)
        .post('/v2/meta')
        .send({
          metaKey: testKey,
          metaValue: testValue,
        });

      // Delete meta value
      const deleteResponse = await supertest(app)
        .delete(`/v2/meta/${testKey}`);

      validateV2SuccessResponse(deleteResponse, 'Meta value deleted successfully');

      // Verify deletion
      const getResponse = await supertest(app)
        .get(`/v2/meta/${testKey}`);

      expect(getResponse.status).to.equal(404);
    }).timeout(getV2TestTimeout());

    it('handles non-existent meta keys', async function () {
      const response = await supertest(app)
        .get('/v2/meta/non-existent-key');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Meta key not found');
    }).timeout(getV2TestTimeout());

    it('validates meta key format', async function () {
      const invalidKey = ''; // Empty key

      const response = await supertest(app)
        .post('/v2/meta')
        .send({
          metaKey: invalidKey,
          metaValue: 'test-value',
        });

      validateV2ErrorResponse(response, 'Meta key is required');
    }).timeout(getV2TestTimeout());
  });

  describe('Governance V2 System Table', function () {
    it('retrieves governance data successfully', async function () {
      const response = await supertest(app).get('/v2/governance');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    }).timeout(getV2TestTimeout());

    it('updates governance data', async function () {
      const testKey = 'v2-test-governance-key';
      const testValue = 'v2-test-governance-value';

      const response = await supertest(app)
        .put('/v2/governance')
        .send({
          metaKey: testKey,
          metaValue: testValue,
        });

      validateV2SuccessResponse(response, 'Governance data updated successfully');
    }).timeout(getV2TestTimeout());

    it('validates governance data structure', async function () {
      const response = await supertest(app).get('/v2/governance');

      expect(response.status).to.equal(200);
      if (response.body.length > 0) {
        const governanceItem = response.body[0];
        expect(governanceItem).to.have.property('metaKey');
        expect(governanceItem).to.have.property('metaValue');
        expect(governanceItem).to.have.property('created_at');
        expect(governanceItem).to.have.property('updated_at');
      }
    }).timeout(getV2TestTimeout());
  });

  describe('Simulator V2 System Table', function () {
    it('retrieves simulator data successfully', async function () {
      const response = await supertest(app).get('/v2/simulator');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    }).timeout(getV2TestTimeout());

    it('sets simulator data', async function () {
      const testKey = 'v2-test-simulator-key';
      const testValue = 'v2-test-simulator-value';

      const response = await supertest(app)
        .post('/v2/simulator')
        .send({
          key: testKey,
          value: testValue,
        });

      validateV2SuccessResponse(response, 'Simulator data set successfully');
    }).timeout(getV2TestTimeout());

    it('updates simulator data', async function () {
      const testKey = 'v2-test-simulator-update-key';
      const initialValue = 'initial-simulator-value';
      const updatedValue = 'updated-simulator-value';

      // Set initial value
      await supertest(app)
        .post('/v2/simulator')
        .send({
          key: testKey,
          value: initialValue,
        });

      // Update value
      const updateResponse = await supertest(app)
        .put(`/v2/simulator/${testKey}`)
        .send({
          value: updatedValue,
        });

      validateV2SuccessResponse(updateResponse, 'Simulator data updated successfully');
    }).timeout(getV2TestTimeout());

    it('deletes simulator data', async function () {
      const testKey = 'v2-test-simulator-delete-key';
      const testValue = 'v2-test-simulator-delete-value';

      // Set simulator data
      await supertest(app)
        .post('/v2/simulator')
        .send({
          key: testKey,
          value: testValue,
        });

      // Delete simulator data
      const deleteResponse = await supertest(app)
        .delete(`/v2/simulator/${testKey}`);

      validateV2SuccessResponse(deleteResponse, 'Simulator data deleted successfully');
    }).timeout(getV2TestTimeout());

    it('validates simulator data structure', async function () {
      const testKey = 'v2-test-simulator-structure-key';
      const testValue = 'v2-test-simulator-structure-value';

      // Set simulator data
      await supertest(app)
        .post('/v2/simulator')
        .send({
          key: testKey,
          value: testValue,
        });

      // Retrieve and validate structure
      const response = await supertest(app).get('/v2/simulator');
      expect(response.status).to.equal(200);

      const simulatorItem = response.body.find(item => item.key === testKey);
      expect(simulatorItem).to.be.ok;
      expect(simulatorItem).to.have.property('id');
      expect(simulatorItem).to.have.property('key', testKey);
      expect(simulatorItem).to.have.property('value', testValue);
      expect(simulatorItem).to.have.property('created_at');
      expect(simulatorItem).to.have.property('updated_at');
    }).timeout(getV2TestTimeout());
  });

  describe('System Table Error Handling', function () {
    it('handles invalid organization UID', async function () {
      const response = await supertest(app)
        .get('/v2/organizations/invalid-uid');

      expect(response.status).to.equal(404);
    }).timeout(getV2TestTimeout());

    it('handles malformed meta requests', async function () {
      const response = await supertest(app)
        .post('/v2/meta')
        .send('invalid json');

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('handles missing required fields in system tables', async function () {
      const response = await supertest(app)
        .post('/v2/meta')
        .send({
          // Missing metaKey
          metaValue: 'test-value',
        });

      validateV2ErrorResponse(response, 'Meta key is required');
    }).timeout(getV2TestTimeout());
  });

  describe('System Table Performance', function () {
    it('handles bulk operations efficiently', async function () {
      const startTime = Date.now();

      // Create multiple meta entries
      const promises = Array.from({ length: 50 }, (_, i) =>
        supertest(app).post('/v2/meta').send({
          metaKey: `v2-bulk-test-key-${i}`,
          metaValue: `v2-bulk-test-value-${i}`,
        })
      );

      await Promise.all(promises);

      // Retrieve all meta entries
      const response = await supertest(app).get('/v2/meta');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(response.status).to.equal(200);
      expect(response.body.length).to.be.greaterThanOrEqual(50);
      expect(executionTime).to.be.lessThan(10000); // Should complete within 10 seconds
    }).timeout(getV2TestTimeout() * 2);
  });

  describe('System Table Data Consistency', function () {
    it('maintains data consistency across system tables', async function () {
      // Set meta value
      const metaKey = 'v2-consistency-test-key';
      const metaValue = 'v2-consistency-test-value';

      await supertest(app)
        .post('/v2/meta')
        .send({
          metaKey,
          metaValue,
        });

      // Set simulator data
      const simulatorKey = 'v2-consistency-simulator-key';
      const simulatorValue = 'v2-consistency-simulator-value';

      await supertest(app)
        .post('/v2/simulator')
        .send({
          key: simulatorKey,
          value: simulatorValue,
        });

      // Verify both exist
      const metaResponse = await supertest(app).get(`/v2/meta/${metaKey}`);
      const simulatorResponse = await supertest(app).get('/v2/simulator');

      expect(metaResponse.status).to.equal(200);
      expect(metaResponse.body.metaValue).to.equal(metaValue);

      expect(simulatorResponse.status).to.equal(200);
      const simulatorItem = simulatorResponse.body.find(item => item.key === simulatorKey);
      expect(simulatorItem).to.be.ok;
      expect(simulatorItem.value).to.equal(simulatorValue);
    }).timeout(getV2TestTimeout());
  });
});
