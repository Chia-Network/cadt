import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import {
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  validateV2Pagination,
  cleanupV2TestData,
  getV2TestTimeout,
} from '../test-fixtures';
import {
  createV2TestAuditRecord,
  getV2AuditRecordCount,
} from '../test-fixtures/v2-common-fixtures';

describe('V2 Audit Resource CRUD', function () {
  let homeOrgUid;

  before(async function () {
    homeOrgUid = await createV2TestHomeOrg();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('GET - Find All Audit Records', function () {
    beforeEach(async function () {
      // Create test audit records
      await createV2TestAuditRecord(homeOrgUid);
      await createV2TestAuditRecord(homeOrgUid);
      await createV2TestAuditRecord('other-org-uid');
    });

    it('retrieves all audit records successfully', async function () {
      const response = await supertest(app).get('/v2/audit');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    }).timeout(getV2TestTimeout());

    it('retrieves audit records with pagination', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({ page: 1, limit: 2, orgUid: homeOrgUid });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.lessThanOrEqual(2);
    }).timeout(getV2TestTimeout());

    it('filters audit records by organization', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({ orgUid: homeOrgUid });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      response.body.forEach(record => {
        expect(record.orgUid).to.equal(homeOrgUid);
      });
    }).timeout(getV2TestTimeout());

    it('orders audit records by timestamp', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({ orgUid: homeOrgUid, order: 'DESC' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');

      // Verify descending order
      for (let i = 1; i < response.body.length; i++) {
        const prev = new Date(response.body[i - 1].onchainConfirmationTimeStamp);
        const curr = new Date(response.body[i].onchainConfirmationTimeStamp);
        expect(prev.getTime()).to.be.greaterThanOrEqual(curr.getTime());
      }
    }).timeout(getV2TestTimeout());

    it('validates required query parameters', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({ page: 1 }); // Missing limit and orgUid

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find Audit Conflicts', function () {
    it('retrieves audit conflicts successfully', async function () {
      const response = await supertest(app).get('/v2/audit/conflicts');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    }).timeout(getV2TestTimeout());

    it('handles empty conflicts gracefully', async function () {
      const response = await supertest(app).get('/v2/audit/conflicts');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    }).timeout(getV2TestTimeout());
  });

  describe('POST - Reset to Generation', function () {
    it('resets audit to specific generation successfully', async function () {
      const resetData = {
        generation: 1,
        orgUid: homeOrgUid,
      };

      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send(resetData);

      validateV2SuccessResponse(response, 'V2 Audit reset to generation successfully');
    }).timeout(getV2TestTimeout());

    it('validates reset data structure', async function () {
      const invalidResetData = {
        // Missing generation field
        orgUid: homeOrgUid,
      };

      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send(invalidResetData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message', 'Generation is required');
    }).timeout(getV2TestTimeout());

    it('validates organization UID', async function () {
      const resetData = {
        generation: 1,
        orgUid: 'invalid-org-uid',
      };

      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send(resetData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Latest Generation', function () {
    it('retrieves latest generation successfully', async function () {
      const response = await supertest(app).get('/v2/audit/latest-generation');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('generation');
      expect(response.body).to.have.property('success', true);
      expect(response.body.generation).to.be.a('number');
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Generation Stats', function () {
    it('retrieves generation statistics successfully', async function () {
      const response = await supertest(app).get('/v2/audit/generation-stats');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('stats');
      expect(response.body).to.have.property('success', true);
      expect(response.body.stats).to.be.an('object');
    }).timeout(getV2TestTimeout());
  });

  describe('Error Handling', function () {
    it('handles invalid generation numbers', async function () {
      const resetData = {
        generation: -1, // Invalid generation
        orgUid: homeOrgUid,
      };

      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send(resetData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('handles non-existent organization', async function () {
      const resetData = {
        generation: 1,
        orgUid: 'non-existent-org',
      };

      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send(resetData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('handles malformed request data', async function () {
      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send('invalid json');

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());
  });

  describe('Data Validation', function () {
    it('validates audit record structure', async function () {
      const auditRecord = await createV2TestAuditRecord(homeOrgUid);

      expect(auditRecord).to.have.property('id');
      expect(auditRecord).to.have.property('orgUid', homeOrgUid);
      expect(auditRecord).to.have.property('type');
      expect(auditRecord).to.have.property('change');
      expect(auditRecord).to.have.property('table');
      expect(auditRecord).to.have.property('generation');
      expect(auditRecord).to.have.property('created_at');
      expect(auditRecord).to.have.property('updated_at');
    }).timeout(getV2TestTimeout());

    it('validates audit record types', async function () {
      const validTypes = ['INSERT', 'UPDATE', 'DELETE'];

      for (const type of validTypes) {
        const auditRecord = await createV2TestAuditRecord(homeOrgUid, {
          type,
          change: `${type} operation`,
          table: 'test_table',
        });

        expect(auditRecord.type).to.equal(type);
      }
    }).timeout(getV2TestTimeout());
  });

  describe('Performance Tests', function () {
    it('handles large number of audit records efficiently', async function () {
      const startTime = Date.now();

      // Create 50 audit records
      const promises = Array.from({ length: 50 }, (_, i) =>
        createV2TestAuditRecord(homeOrgUid, {
          type: 'INSERT',
          change: `Test change ${i}`,
          table: 'test_table',
          generation: i + 1,
        })
      );

      await Promise.all(promises);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({ orgUid: homeOrgUid });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(response.status).to.equal(200);
      expect(response.body.length).to.be.greaterThanOrEqual(50);
      expect(executionTime).to.be.lessThan(10000); // Should complete within 10 seconds
    }).timeout(getV2TestTimeout() * 2);
  });

  describe('Security Tests', function () {
    it('prevents access to other organizations audit data', async function () {
      const otherOrgUid = 'other-org-uid';
      await createV2TestAuditRecord(otherOrgUid);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({ orgUid: homeOrgUid });

      expect(response.status).to.equal(200);
      response.body.forEach(record => {
        expect(record.orgUid).to.equal(homeOrgUid);
        expect(record.orgUid).to.not.equal(otherOrgUid);
      });
    }).timeout(getV2TestTimeout());

    it('validates organization ownership for reset operations', async function () {
      const resetData = {
        generation: 1,
        orgUid: 'unauthorized-org',
      };

      const response = await supertest(app)
        .post('/v2/audit/reset')
        .send(resetData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());
  });
});
