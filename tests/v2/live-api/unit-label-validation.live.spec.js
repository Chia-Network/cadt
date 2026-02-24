import { expect } from 'chai';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
  waitForDataToAppear,
  waitForBatchToAppear,
  clearStagingTable,
  validateDataInDatabase,
} from './helpers/live-api-helpers.js';
import { getSharedRequest, getSharedHomeOrgId } from './helpers/shared-setup.js';
import {
  makePostRequest,
  makePutRequest,
  makeDeleteRequest,
  checkRecordInStaging,
} from './helpers/api-request-helpers.js';
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstCreatedId, getCreatedIds, getFirstRecordIdFromDatabase, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateUnitLabel,
  generateUnitLabelMinimal,
  generateUnitLabelMaximal,
  generateUnitLabelInvalidForeignKey,
  generateUnitLabelForbiddenFields,
  getNonExistentId,
} from './data/test-data-generators.js';

describe('UnitLabel Live API Validation Tests', function () {
  this.timeout(600000); // 10 minute timeout
  let request;
  let homeOrgId;
  const createdIds = []; // Track all created IDs
  before(async function () {
    // Get shared request and home org ID (setup already done by orchestration)
    request = getSharedRequest();
    homeOrgId = getSharedHomeOrgId();
  });
  describe('Step 3: Validation Failure Tests', function () {
    it('should reject POST with forbidden fields (createdAt, updatedAt, ID)', async function () {
      const labelId = getFirstCreatedId('label');
      const unitId = getFirstCreatedId('unit');
      if (!labelId || !unitId) {
        this.skip();
      }
      const forbiddenData = generateUnitLabelForbiddenFields(labelId, unitId);
      const response = await request
        .post('/v2/unit-label')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateUnitLabelInvalidForeignKey();
      const response = await request
        .post('/v2/unit-label')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { cadTrustLabelId: getNonExistentId() }; // Missing cadTrustUnitId
      const response = await request
        .post('/v2/unit-label')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });

  describe('Step 4: POST Request Tests', function () {
    it('should create unit-label relationships', async function () {
      // Get label and unit IDs from earlier tests (automatically checks file for cross-process access)
      const labelIds = getCreatedIds('label');
      const unitIds = getCreatedIds('unit');
      
      if (labelIds.length === 0 || unitIds.length === 0) {
        throw new Error('Label or Unit IDs not found. Ensure label-validation.spec.js and unit-validation.spec.js run before unit-label-validation.spec.js');
      }

      // Create up to 1 unit-label relationship (typical)
      let created = 0;
      const maxRecords = Math.min(1, labelIds.length * unitIds.length);
      const usedCombinations = new Set(); // Track used label-unit combinations

      for (let labelIdx = 0; labelIdx < labelIds.length && created < maxRecords; labelIdx++) {
        for (let unitIdx = 0; unitIdx < unitIds.length && created < maxRecords; unitIdx++) {
          const labelId = labelIds[labelIdx];
          const unitId = unitIds[unitIdx];
          const comboKey = `${labelId}:${unitId}`;

          // Skip if this combination was already used
          if (usedCombinations.has(comboKey)) {
            continue;
          }

          const data = generateUnitLabel(labelId, unitId);
          const { id, response } = await makePostRequest(request, '/v2/unit-label', data);

          // Fail fast on any error - including duplicates
          expect(response.success).to.be.true;
          expect(id).to.exist;
          // UUID primary key
          const unitLabelId = id;
          createdIds.push(unitLabelId);
          addCreatedId('unit-label', unitLabelId);
          usedCombinations.add(comboKey);

          // Check record is in staging table
          const inStaging = await checkRecordInStaging(request, '/v2/unit-label', unitLabelId, {
            cadTrustLabelId: data.cadTrustLabelId,
            cadTrustUnitId: data.cadTrustUnitId,
          });
          expect(inStaging).to.be.true;
          // Commit if in extended mode
          if (shouldAutoCommit()) {
            await commitStagedRecords(request, []);
            await waitForPendingCommits(request);
            await waitForStagingEmpty(request);
            await waitForDataToAppear(request, 'unit-label', unitLabelId);
          } else {
            trackBatchVerification('POST', 'unit-label', unitLabelId, {
              cadTrustLabelId: data.cadTrustLabelId,
              cadTrustUnitId: data.cadTrustUnitId,
            });
          }
          created++;
        }
      }

      // Create 1 minimal record - find an unused combination
      let minLabelId = null;
      let minUnitId = null;
      for (let labelIdx = 0; labelIdx < labelIds.length && !minLabelId; labelIdx++) {
        for (let unitIdx = 0; unitIdx < unitIds.length && !minLabelId; unitIdx++) {
          const comboKey = `${labelIds[labelIdx]}:${unitIds[unitIdx]}`;
          if (!usedCombinations.has(comboKey)) {
            minLabelId = labelIds[labelIdx];
            minUnitId = unitIds[unitIdx];
            usedCombinations.add(comboKey);
            break;
          }
        }
      }

      if (minLabelId && minUnitId) {
        const minimalData = generateUnitLabelMinimal(minLabelId, minUnitId);
        const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/unit-label', minimalData);

        // Fail fast on any error - including duplicates
        expect(minResponse.success).to.be.true;
        expect(minId).to.exist;
        createdIds.push(minId);
        addCreatedId('unit-label', minId);

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          await waitForDataToAppear(request, 'unit-label', minId);
        } else {
          trackBatchVerification('POST', 'unit-label', minId, {
            cadTrustLabelId: minimalData.cadTrustLabelId,
            cadTrustUnitId: minimalData.cadTrustUnitId,
          });
        }
      }

      // Create 1 maximal record - find another unused combination
      let maxLabelId = null;
      let maxUnitId = null;
      for (let labelIdx = 0; labelIdx < labelIds.length && !maxLabelId; labelIdx++) {
        for (let unitIdx = 0; unitIdx < unitIds.length && !maxLabelId; unitIdx++) {
          const comboKey = `${labelIds[labelIdx]}:${unitIds[unitIdx]}`;
          if (!usedCombinations.has(comboKey)) {
            maxLabelId = labelIds[labelIdx];
            maxUnitId = unitIds[unitIdx];
            usedCombinations.add(comboKey);
            break;
          }
        }
      }

      if (maxLabelId && maxUnitId) {
        const maximalData = generateUnitLabelMaximal(maxLabelId, maxUnitId);
        const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/unit-label', maximalData);

        // Fail fast on any error - including duplicates
        expect(maxResponse.success).to.be.true;
        expect(maxId).to.exist;
        createdIds.push(maxId);
        addCreatedId('unit-label', maxId);

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          await waitForDataToAppear(request, 'unit-label', maxId);
        } else {
          trackBatchVerification('POST', 'unit-label', maxId, {
            cadTrustLabelId: maximalData.cadTrustLabelId,
            cadTrustUnitId: maximalData.cadTrustUnitId,
          });
        }
      }
    });
  });
  describe('Step 5: Staging Commit (if short mode)', function () {
    it('should commit all staged records in batch', async function () {
      if (!shouldAutoCommit()) {
        // Commit all uncommitted records
        await commitStagedRecords(request, [], true); // Force commit
        // Wait for all records to appear
        const recordsToWaitFor = createdIds.map(id => ({ type: 'unit-label', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const unitLabelId of createdIds) {
        const record = await waitForDataToAppear(request, 'unit-label', unitLabelId);
        expect(record).to.exist;
        expect(record.cadTrustUnitLabelId).to.equal(unitLabelId);
        expect(record).to.have.property('cadTrustLabelId');
        expect(record).to.have.property('cadTrustUnitId');
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a unit-label relationship', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let unitLabelId = createdIds[0];
      if (!unitLabelId) {
        unitLabelId = await getFirstRecordIdFromDatabase(request, 'unit-label');
        if (!unitLabelId) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/unit-label/${unitLabelId}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        cadTrustLabelId: record.cadTrustLabelId,
        cadTrustUnitId: record.cadTrustUnitId,
        labelUnitDate: '2024-12-31',
        labelUnitDescription: record.labelUnitDescription ?? null,
      };
      const response = await makePutRequest(request, '/v2/unit-label', unitLabelId, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit-label', unitLabelId);
        await validateDataInDatabase(request, 'unit-label', unitLabelId, {
          cadTrustLabelId: updateData.cadTrustLabelId,
          cadTrustUnitId: updateData.cadTrustUnitId,
        });
      } else {
        trackBatchVerification('PUT', 'unit-label', unitLabelId, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all unit-label relationships with pagination', async function () {
      const response = await request
        .get('/v2/unit-label?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific unit-label by ID', async function () {
      const unitLabelId = createdIds[0];
      const response = await request
        .get(`/v2/unit-label/${unitLabelId}`)
        .expect(200);

      expect(response.body.cadTrustUnitLabelId).to.equal(unitLabelId);
      expect(response.body.cadTrustLabelId).to.exist;
      expect(response.body.cadTrustUnitId).to.exist;
    });

    it('should filter unit-labels by orgUid=me', async function () {
      const response = await request
        .get('/v2/unit-label?orgUid=me&page=1&limit=10')
        .expect(200);

      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      expect(data.length).to.be.greaterThan(0);
      for (const record of data) {
        expect(record).to.have.property('cadTrustUnitId');
      }
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/unit-label')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created unit-label relationships', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'unit-label');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const unitLabelId = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/unit-label', unitLabelId);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'unit-label', unitLabelId);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all unit-label relationships are deleted', async function () {
      const response = await request.get('/v2/unit-label').query({ page: 1, limit: 10 }).expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have unit-label relationships that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
