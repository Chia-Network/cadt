import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import newProgram from '../test-data/new-program.js';
import newProject from '../test-data/new-project.js';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  validateV2Pagination,
  cleanupV2TestData,
  getV2TestTimeout,
} from '../test-fixtures';
import {
  createV2StagingRecord,
  validateV2StagingRecord,
  validateV2StagingData,
  commitV2StagingRecord,
  failV2StagingRecord,
  retryV2StagingRecord,
  getV2StagingByType,
  getV2StagingByTable,
  validateV2StagingDiff,
  cleanupV2StagingTable,
  createV2StagingBatch,
  validateV2StagingBatch,
} from '../test-fixtures/v2-staging-fixtures';

describe('V2 Staging Resource CRUD', function () {
  let homeOrgUid;

  before(async function () {
    homeOrgUid = await createV2TestHomeOrg();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('GET - Find All Staging Records', function () {
    beforeEach(async function () {
      // Create test staging records
      await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([newProgram]),
      });

      await createV2StagingRecord({
        table: 'project',
        action: 'INSERT',
        data: JSON.stringify([newProject]),
      });
    });

    it('retrieves all staging records successfully', async function () {
      const response = await supertest(app).get('/v2/staging');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.equal(2);
    }).timeout(getV2TestTimeout());

    it('retrieves staging records with pagination', async function () {
      const response = await supertest(app)
        .get('/v2/staging')
        .query({ page: 1, limit: 1 });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.equal(1);
    }).timeout(getV2TestTimeout());

    it('filters staging records by type', async function () {
      const response = await supertest(app)
        .get('/v2/staging')
        .query({ type: 'staged' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      response.body.forEach(record => {
        expect(record.commited).to.equal(false);
        expect(record.failedCommit).to.equal(false);
      });
    }).timeout(getV2TestTimeout());

    it('filters staging records by table', async function () {
      const response = await supertest(app)
        .get('/v2/staging')
        .query({ table: 'program' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      response.body.forEach(record => {
        expect(record.table).to.equal('program');
      });
    }).timeout(getV2TestTimeout());

    it('includes diff objects for staging records', async function () {
      const response = await supertest(app).get('/v2/staging');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      response.body.forEach(record => {
        expect(record).to.have.property('diff');
        expect(record.diff).to.be.an('object');
        expect(record.diff).to.have.property('original');
        expect(record.diff).to.have.property('change');
      });
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Check Pending Commits', function () {
    beforeEach(async function () {
      // Create a committed staging record
      const stagingRecord = await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([newProgram]),
      });
      await commitV2StagingRecord(stagingRecord.uuid);
    });

    it('detects pending commits', async function () {
      const response = await supertest(app).get('/v2/staging/offer');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('pending commits');
    }).timeout(getV2TestTimeout());

    it('detects no pending commits when staging is empty', async function () {
      await cleanupV2StagingTable();

      const response = await supertest(app).get('/v2/staging/offer');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('No pending commits');
    }).timeout(getV2TestTimeout());
  });

  describe('POST - Commit Staging Records', function () {
    beforeEach(async function () {
      // Create staging records to commit
      await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([newProgram]),
      });
    });

    it('commits staging records successfully', async function () {
      const commitData = {
        comment: 'Test commit',
        author: 'test-author',
        ids: [],
      };

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send(commitData);

      validateV2SuccessResponse(response, 'V2 Staging Table committed to full node');
    }).timeout(getV2TestTimeout());

    it('commits specific staging records by IDs', async function () {
      const stagingRecord = await createV2StagingRecord({
        table: 'project',
        action: 'INSERT',
        data: JSON.stringify([newProject]),
      });

      const commitData = {
        comment: 'Test commit specific records',
        author: 'test-author',
        ids: [stagingRecord.uuid],
      };

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send(commitData);

      validateV2SuccessResponse(response, 'V2 Staging Table committed to full node');
    }).timeout(getV2TestTimeout());

    it('validates commit data structure', async function () {
      const invalidCommitData = {
        // Missing required fields
      };

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send(invalidCommitData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());
  });

  describe('PUT - Edit Staging Record', function () {
    let stagingRecord;

    beforeEach(async function () {
      stagingRecord = await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([newProgram]),
      });
    });

    it('edits staging record data successfully', async function () {
      const editData = {
        uuid: stagingRecord.uuid,
        data: JSON.stringify([{ ...newProgram, programName: 'Updated Program Name' }]),
      };

      const response = await supertest(app)
        .put('/v2/staging')
        .send(editData);

      validateV2SuccessResponse(response, 'V2 Staging record updated');
    }).timeout(getV2TestTimeout());

    it('validates edit data structure', async function () {
      const invalidEditData = {
        uuid: stagingRecord.uuid,
        // Missing data field
      };

      const response = await supertest(app)
        .put('/v2/staging')
        .send(invalidEditData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('returns error for non-existent staging record', async function () {
      const editData = {
        uuid: 'non-existent-uuid',
        data: JSON.stringify([newProgram]),
      };

      const response = await supertest(app)
        .put('/v2/staging')
        .send(editData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('not found');
    }).timeout(getV2TestTimeout());
  });

  describe('PUT - Retry Staging Record', function () {
    let stagingRecord;

    beforeEach(async function () {
      stagingRecord = await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([newProgram]),
      });
      await failV2StagingRecord(stagingRecord.uuid);
    });

    it('retries failed staging record successfully', async function () {
      const retryData = {
        uuid: stagingRecord.uuid,
      };

      const response = await supertest(app)
        .put('/v2/staging/retry')
        .send(retryData);

      validateV2SuccessResponse(response, 'V2 Staging record re-staged');
    }).timeout(getV2TestTimeout());

    it('validates retry data structure', async function () {
      const invalidRetryData = {
        // Missing uuid field
      };

      const response = await supertest(app)
        .put('/v2/staging/retry')
        .send(invalidRetryData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('returns error for non-existent staging record', async function () {
      const retryData = {
        uuid: 'non-existent-uuid',
      };

      const response = await supertest(app)
        .put('/v2/staging/retry')
        .send(retryData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('not found');
    }).timeout(getV2TestTimeout());
  });

  describe('DELETE - Delete Staging Record', function () {
    let stagingRecord;

    beforeEach(async function () {
      stagingRecord = await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([newProgram]),
      });
    });

    it('deletes staging record successfully', async function () {
      const deleteData = {
        uuid: stagingRecord.uuid,
      };

      const response = await supertest(app)
        .delete('/v2/staging')
        .send(deleteData);

      validateV2SuccessResponse(response, 'V2 Staging record deleted');
    }).timeout(getV2TestTimeout());

    it('validates delete data structure', async function () {
      const invalidDeleteData = {
        // Missing uuid field
      };

      const response = await supertest(app)
        .delete('/v2/staging')
        .send(invalidDeleteData);

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('returns error for non-existent staging record', async function () {
      const deleteData = {
        uuid: 'non-existent-uuid',
      };

      const response = await supertest(app)
        .delete('/v2/staging')
        .send(deleteData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('not found');
    }).timeout(getV2TestTimeout());
  });

  describe('DELETE - Clean Staging Table', function () {
    beforeEach(async function () {
      // Create multiple staging records
      await createV2StagingBatch([
        { table: 'program', action: 'INSERT' },
        { table: 'project', action: 'INSERT' },
        { table: 'unit', action: 'INSERT' },
      ]);
    });

    it('cleans entire staging table successfully', async function () {
      const response = await supertest(app).delete('/v2/staging/clean');

      validateV2SuccessResponse(response, 'V2 Staging Data Cleaned');
    }).timeout(getV2TestTimeout());

    it('verifies staging table is empty after clean', async function () {
      await supertest(app).delete('/v2/staging/clean');

      const response = await supertest(app).get('/v2/staging');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.equal(0);
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Has Pending Transactions', function () {
    it('returns pending transactions status', async function () {
      const response = await supertest(app).get('/v2/staging/hasPendingTransactions');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('success', true);
    }).timeout(getV2TestTimeout());
  });

  describe('Error Handling', function () {
    it('handles malformed JSON in staging data', async function () {
      const stagingRecord = await createV2StagingRecord({
        table: 'program',
        action: 'INSERT',
        data: 'invalid json data',
      });

      const response = await supertest(app).get('/v2/staging');

      expect(response.status).to.equal(200);
      // Should handle gracefully
    }).timeout(getV2TestTimeout());

    it('handles empty staging table gracefully', async function () {
      await cleanupV2StagingTable();

      const response = await supertest(app).get('/v2/staging');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.equal(0);
    }).timeout(getV2TestTimeout());
  });

  describe('Performance Tests', function () {
    it('handles large number of staging records efficiently', async function () {
      const startTime = Date.now();

      // Create 100 staging records
      const records = Array.from({ length: 100 }, (_, i) => ({
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([{ ...newProgram, programName: `Program ${i}` }]),
      }));

      await createV2StagingBatch(records);

      const response = await supertest(app).get('/v2/staging');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(response.status).to.equal(200);
      expect(response.body.length).to.equal(100);
      expect(executionTime).to.be.lessThan(5000); // Should complete within 5 seconds
    }).timeout(getV2TestTimeout() * 2);
  });
});
