import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AuditV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

/**
 * Phase 17.3: AuditV2 Controller Reset Endpoints Tests
 *
 * Tests for POST /v2/audit/resetToGeneration and POST /v2/audit/resetToDate endpoints
 */
describe('Phase 17.3: AuditV2 Controller Reset Endpoints', function () {
  this.timeout(30000);

  let testOrgUid;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Clean up any existing data
    await AuditV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  beforeEach(async function () {
    // Clean up audit records before each test
    await AuditV2.destroy({ where: {} });
  });

  describe('POST /v2/audit/resetToGeneration', function () {
    it('should delete records with generation greater than specified', async function () {
      // Create test audit records
      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 2,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash3',
          type: 'delete',
          change: '{"test": "data3"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 2).toString(),
          generation: 3,
        },
      ]);

      const response = await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          orgUid: testOrgUid,
          generation: 1,
        })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('reset to generation 1');

      // Verify records were deleted
      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(1);
      expect(remaining.rows[0].generation).to.equal(1);
    });

    it('should return error for invalid orgUid', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          orgUid: 'invalid-org-uid',
          generation: 1,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('failed to change generation');
      expect(response.body.error).to.include('is not in the list of subscribed organizations');
    });

    it('should return error when generation is missing', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          orgUid: testOrgUid,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });

    it('should return error when orgUid is missing', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          generation: 1,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });
  });

  describe('POST /v2/audit/resetToDate', function () {
    it('should delete records with timestamp greater than specified date', async function () {
      const baseTime = Math.floor(Date.now() / 1000);
      const date1 = new Date((baseTime - 100) * 1000); // 100 seconds ago
      const date2 = new Date((baseTime - 50) * 1000);  // 50 seconds ago
      const date3 = new Date((baseTime + 50) * 1000);  // 50 seconds in future

      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime - 100).toString(),
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime - 50).toString(),
          generation: 2,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash3',
          type: 'delete',
          change: '{"test": "data3"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime + 50).toString(),
          generation: 3,
        },
      ]);

      // Reset to date between date1 and date2
      const resetDate = new Date((baseTime - 75) * 1000);
      const response = await supertest(app)
        .post('/v2/audit/resetToDate')
        .send({
          orgUid: testOrgUid,
          date: resetDate.toISOString(),
        })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('reset to date');

      // Verify records were deleted (generations 2 and 3 should be gone)
      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(1);
      expect(remaining.rows[0].generation).to.equal(1);
    });

    it('should return error for invalid orgUid', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToDate')
        .send({
          orgUid: 'invalid-org-uid',
          date: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('failed to reset to date');
      expect(response.body.error).to.include('is not in the list of subscribed organizations');
    });

    it('should return error when date is missing', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToDate')
        .send({
          orgUid: testOrgUid,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });

    it('should work without orgUid (resets all orgs except home)', async function () {
      // Create another org
      const otherOrg = await OrganizationsV2.create({
        org_uid: 'other-org-uid-reset',
        name: 'Other Org Reset',
        registry_id: 'other-registry-reset',
        is_home: false,
        subscribed: true,
      });

      const baseTime = Math.floor(Date.now() / 1000);
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime + 100).toString(),
          generation: 1,
        },
        {
          org_uid: otherOrg.org_uid,
          registry_id: 'other-registry-reset',
          root_hash: 'hash2',
          type: 'insert',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (baseTime + 100).toString(),
          generation: 1,
        },
      ]);

      const resetDate = new Date((baseTime + 50) * 1000);
      const response = await supertest(app)
        .post('/v2/audit/resetToDate')
        .send({
          date: resetDate.toISOString(),
        })
        .expect(200);

      expect(response.body.success).to.be.true;

      // Verify other org's record was deleted but home org's was not
      const homeOrgRecords = await AuditV2.findAuditHistory(testOrgUid);
      expect(homeOrgRecords.count).to.equal(1);
    });
  });
});

