import { expect } from 'chai';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
  clearStagingTable,
} from './helpers/live-api-helpers.js';
import { getSharedRequest } from './helpers/shared-setup.js';
import { makePostRequest } from './helpers/api-request-helpers.js';
import { generateProject, generateUnit } from './data/test-data-generators.js';

describe('Staging Live API Validation Tests', function () {
  this.timeout(600000); // 10 minute timeout
  let request;

  before(async function () {
    request = getSharedRequest();
  });

  describe('Step 1: Staging Table Operations', function () {
    it('should list all staged records', async function () {
      const response = await request.get('/v1/staging').expect(200);
      expect(response.body).to.exist;
      // Response might be array or object with data property
      const records = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      expect(Array.isArray(records)).to.be.true;
    });

    it('should stage a project record', async function () {
      const data = generateProject();
      const { id, response } = await makePostRequest(request, '/v1/projects', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;

      // Verify record is in staging
      const stagingResponse = await request.get('/v1/staging').expect(200);
      const records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);
      const stagedRecord = records.find(r => r.uuid === id);
      expect(stagedRecord).to.exist;
      expect(stagedRecord.table).to.equal('projects');
    });

    it('should stage a unit record', async function () {
      const data = generateUnit();
      const { id, response } = await makePostRequest(request, '/v1/units', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;

      // Verify record is in staging
      const stagingResponse = await request.get('/v1/staging').expect(200);
      const records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);
      const stagedRecord = records.find(r => r.uuid === id);
      expect(stagedRecord).to.exist;
      expect(stagedRecord.table).to.equal('units');
    });
  });

  describe('Step 2: Staging Commit Operations', function () {
    it('should commit all staged records', async function () {
      // Get all staged records
      const stagingResponse = await request.get('/v1/staging').expect(200);
      const records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);
      const uuids = records.map(r => r.uuid);

      if (uuids.length === 0) {
        this.skip(); // No records to commit
      }

      // Commit all records
      const commitResponse = await commitStagedRecords(request, uuids, true);
      expect(commitResponse).to.exist;

      // Wait for commit to complete
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);
    });

    it('should commit specific staged records by UUID', async function () {
      // Create a new project to commit
      const data = generateProject();
      const { id, response } = await makePostRequest(request, '/v1/projects', data);
      expect(response.success).to.be.true;

      // Commit only this specific record
      const commitResponse = await commitStagedRecords(request, [id], true);
      expect(commitResponse).to.exist;

      // Wait for commit to complete
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);
    });

    it('should commit all uncommitted records when no UUIDs provided', async function () {
      // Create records
      const projectData = generateProject();
      const unitData = generateUnit();
      const { id: projectId } = await makePostRequest(request, '/v1/projects', projectData);
      const { id: unitId } = await makePostRequest(request, '/v1/units', unitData);

      // Commit all (no UUIDs specified)
      const commitResponse = await commitStagedRecords(request, [], true);
      expect(commitResponse).to.exist;

      // Wait for commit to complete
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);
    });
  });

  describe('Step 3: Staging Clean Operations', function () {
    it('should clear all staged records', async function () {
      // Create some records
      const projectData = generateProject();
      const unitData = generateUnit();
      await makePostRequest(request, '/v1/projects', projectData);
      await makePostRequest(request, '/v1/units', unitData);

      // Verify records are staged
      let stagingResponse = await request.get('/v1/staging').expect(200);
      let records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);
      expect(records.length).to.be.greaterThan(0);

      // Clear staging table
      await clearStagingTable(request);

      // Verify staging is empty
      stagingResponse = await request.get('/v1/staging').expect(200);
      records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);
      expect(records.length).to.equal(0);
    });
  });
});
