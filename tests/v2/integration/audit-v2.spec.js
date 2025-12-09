import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AuditV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { Audit } from '../../../src/models/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

/**
 * Phase 17.5: AuditV2 Comprehensive Integration Tests
 *
 * Comprehensive integration tests for all audit endpoints covering:
 * - GET /v2/audit - Get audit history with pagination, filtering, ordering
 * - GET /v2/audit/findConflicts - Find conflicts
 * - POST /v2/audit/resetToGeneration - Reset to generation
 * - POST /v2/audit/resetToDate - Reset to date
 * - Error handling
 * - V1/V2 isolation
 */
describe('Phase 17.5: AuditV2 Comprehensive Integration Tests', function () {
  this.timeout(30000);

  let testOrgUid;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Clean up any existing data
    await AuditV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });
    await Audit.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  beforeEach(async function () {
    // Clean up audit records before each test
    await AuditV2.destroy({ where: {} });
    await Audit.destroy({ where: {} });
  });

  describe('GET /v2/audit - Get audit history with pagination', function () {
    it('should return paginated audit history', async function () {
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
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 2,
        })
        .expect(200);

      expect(response.body).to.have.property('page', 1);
      expect(response.body).to.have.property('pageCount', 2);
      expect(response.body.data).to.have.length(2);
    });
  });

  describe('GET /v2/audit - Get audit history filtered by orgUid', function () {
    it('should filter audit history by orgUid', async function () {
      // Create another org
      const otherOrg = await OrganizationsV2.create({
        org_uid: 'other-org-uid-filter',
        name: 'Other Org Filter',
        registry_id: 'other-registry-filter',
        is_home: false,
        subscribed: true,
      });

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
          org_uid: otherOrg.org_uid,
          registry_id: 'other-registry-filter',
          root_hash: 'hash2',
          type: 'insert',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 1,
        },
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].org_uid).to.equal(testOrgUid);
    });
  });

  describe('GET /v2/audit - Get audit history with ordering', function () {
    it('should return audit history ordered DESC by default', async function () {
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
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body.data).to.have.length(2);
      expect(response.body.data[0].generation).to.equal(2);
      expect(response.body.data[1].generation).to.equal(1);
    });

    it('should return audit history ordered ASC when specified', async function () {
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
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
          order: 'ASC',
        })
        .expect(200);

      expect(response.body.data).to.have.length(2);
      expect(response.body.data[0].generation).to.equal(1);
      expect(response.body.data[1].generation).to.equal(2);
    });
  });

  describe('GET /v2/audit/findConflicts - Find conflicts', function () {
    it('should return empty array (placeholder implementation)', async function () {
      const response = await supertest(app)
        .get('/v2/audit/findConflicts')
        .query({
          orgUid: testOrgUid,
        })
        .expect(200);

      expect(response.body).to.be.an('array').that.is.empty;
    });

    it('should work without orgUid parameter', async function () {
      const response = await supertest(app)
        .get('/v2/audit/findConflicts')
        .expect(200);

      expect(response.body).to.be.an('array').that.is.empty;
    });
  });

  describe('POST /v2/audit/resetToGeneration - Reset to generation', function () {
    it('should reset audit records to specified generation', async function () {
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
  });

  describe('POST /v2/audit/resetToDate - Reset to date', function () {
    it('should reset audit records to specified date', async function () {
      const baseTime = Math.floor(Date.now() / 1000);
      const date1 = new Date((baseTime - 100) * 1000);
      const date2 = new Date((baseTime - 50) * 1000);
      const date3 = new Date((baseTime + 50) * 1000);

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

      // Verify records were deleted
      const remaining = await AuditV2.findAuditHistory(testOrgUid);
      expect(remaining.count).to.equal(1);
      expect(remaining.rows[0].generation).to.equal(1);
    });
  });

  describe('Error handling - Invalid orgUid', function () {
    it('should return error for invalid orgUid in GET /v2/audit', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: 'invalid-org-uid',
          page: 1,
          limit: 10,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Cannot retrieve audit data');
      expect(response.body.error).to.include('is not in the list of subscribed organizations');
    });

    it('should return error for invalid orgUid in POST /v2/audit/resetToGeneration', async function () {
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

    it('should return error for invalid orgUid in POST /v2/audit/resetToDate', async function () {
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
  });

  describe('Error handling - Missing required parameters', function () {
    it('should return error when page and limit are missing in GET /v2/audit', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });
  });

  describe('Security - Input validation for pagination and ordering', function () {
    it('should reject invalid limit value (too large)', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10001, // Exceeds maximum of 10000
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Invalid limit value');
    });

    it('should reject invalid limit value (negative)', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: -1,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Invalid limit value');
    });

    it('should reject invalid limit value (non-numeric)', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 'not-a-number',
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Invalid limit value');
    });

    it('should reject invalid page value (too large)', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 100001, // Exceeds maximum of 100000
          limit: 10,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Invalid page value');
    });

    it('should reject invalid page value (negative)', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: -1,
          limit: 10,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Invalid page value');
    });

    it('should reject invalid page value (non-numeric)', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 'not-a-number',
          limit: 10,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Invalid page value');
    });

    it('should accept valid limit and page values at maximum bounds', async function () {
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
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10000, // Maximum allowed
        })
        .expect(200);

      expect(response.body.success).to.not.equal(false);
    });

    it('should accept valid order values (ASC)', async function () {
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
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
          order: 'ASC',
        })
        .expect(200);

      expect(response.body.success).to.not.equal(false);
    });

    it('should accept valid order values (DESC)', async function () {
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
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
          order: 'DESC',
        })
        .expect(200);

      expect(response.body.success).to.not.equal(false);
    });

    it('should default to DESC for invalid order value', async function () {
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
      ]);

      // Invalid order should default to DESC
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
          order: 'INVALID',
        })
        .expect(200);

      // Should still return results, ordered DESC by default
      expect(response.body.data).to.have.length(2);
      expect(response.body.data[0].generation).to.equal(2); // DESC order
    });

    it('should return error when generation is missing in POST /v2/audit/resetToGeneration', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          orgUid: testOrgUid,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });

    it('should return error when orgUid is missing in POST /v2/audit/resetToGeneration', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          generation: 1,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });

    it('should return error when date is missing in POST /v2/audit/resetToDate', async function () {
      const response = await supertest(app)
        .post('/v2/audit/resetToDate')
        .send({
          orgUid: testOrgUid,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });
  });

  describe('V1/V2 isolation - Verify V2 audit doesn\'t affect V1', function () {
    it('should not affect V1 audit records when creating V2 audit records', async function () {
      // Create V1 audit record
      const v1Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      // Note: V1 Organization model uses different structure
      // For this test, we'll just verify V2 operations don't interfere
      const now = Math.floor(Date.now() / 1000).toString();

      // Create V2 audit record
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
      ]);

      // Verify V2 record exists
      const v2Records = await AuditV2.findAuditHistory(testOrgUid);
      expect(v2Records.count).to.equal(1);

      // Verify V1 audit table is separate (should be empty or have different records)
      // Note: We can't easily create V1 audit records without V1 org setup,
      // but we can verify the tables are separate
      const v1Count = await Audit.count();
      const v2Count = await AuditV2.count();

      // V2 should have 1 record, V1 should have 0 (or different count)
      expect(v2Count).to.equal(1);
      // V1 and V2 counts should be independent
      expect(v1Count).to.not.equal(v2Count);
    });

    it('should not affect V1 audit records when resetting V2 audit records', async function () {
      const now = Math.floor(Date.now() / 1000).toString();

      // Create V2 audit records
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
      ]);

      const v2CountBefore = await AuditV2.count();
      const v1CountBefore = await Audit.count();

      // Reset V2 audit
      await supertest(app)
        .post('/v2/audit/resetToGeneration')
        .send({
          orgUid: testOrgUid,
          generation: 1,
        })
        .expect(200);

      const v2CountAfter = await AuditV2.count();
      const v1CountAfter = await Audit.count();

      // V2 count should have decreased
      expect(v2CountAfter).to.be.lessThan(v2CountBefore);
      // V1 count should remain unchanged
      expect(v1CountAfter).to.equal(v1CountBefore);
    });
  });
});

