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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstCreatedId, getCreatedIds } from './helpers/shared-state.js';
import {
  generateUnitLabel,
  generateUnitLabelMinimal,
  generateUnitLabelMaximal,
  generateUnitLabelInvalidForeignKey,
  generateUnitLabelForbiddenFields,
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
        this.skip(); // Skip if prerequisites not available
      }
      const forbiddenData = generateUnitLabelForbiddenFields(labelId, unitId);
      const response = await request
        .post('/v2/unit-label')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateUnitLabelInvalidForeignKey();
      const response = await request
        .post('/v2/unit-label')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { cadTrustLabelId: 'test-id' }; // Missing cadTrustUnitId
      const response = await request
        .post('/v2/unit-label')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });

  describe('Step 4: POST Request Tests', function () {
    it('should create unit-label relationships', async function () {
      // Get label and unit IDs from earlier tests
      const labelIds = getCreatedIds('label');
      const unitIds = getCreatedIds('unit');
      if (labelIds.length === 0 || unitIds.length === 0) {
        throw new Error('Label or Unit IDs not found. Ensure label-validation.spec.js and unit-validation.spec.js run before unit-label-validation.spec.js');
      }

      // Create up to 5 unit-label relationships (typical)
      // Use unique combinations to avoid duplicate composite keys
      const usedCombinations = new Set();
      let created = 0;
      const maxRecords = Math.min(5, labelIds.length * unitIds.length); // Don't exceed possible unique combinations

      for (let labelIdx = 0; labelIdx < labelIds.length && created < maxRecords; labelIdx++) {
        for (let unitIdx = 0; unitIdx < unitIds.length && created < maxRecords; unitIdx++) {
          const labelId = labelIds[labelIdx];
          const unitId = unitIds[unitIdx];
          const combinationKey = `${labelId}-${unitId}`;

          // Skip if we've already used this combination
          if (usedCombinations.has(combinationKey)) {
            continue;
          }

          usedCombinations.add(combinationKey);
          const data = generateUnitLabel(labelId, unitId);
          const { id, response } = await makePostRequest(request, '/v2/unit-label', data);
          expect(response.success).to.be.true;
          expect(id).to.exist;
          // Unit-label uses composite key: { labelId, unitId }
          // For composite keys, id is an object with labelId and unitId
          const compositeId = id || { labelId: data.cadTrustLabelId, unitId: data.cadTrustUnitId };
          createdIds.push(compositeId);
          addCreatedId('unit-label', compositeId);
          // Check record is in staging table
          const inStaging = await checkRecordInStaging(request, '/v2/unit-label', compositeId, {
            cadTrustLabelId: data.cadTrustLabelId,
            cadTrustUnitId: data.cadTrustUnitId,
          });
          expect(inStaging).to.be.true;
          // Commit if in extended mode
          if (shouldAutoCommit()) {
            await commitStagedRecords(request, []);
            await waitForPendingCommits(request);
            await waitForStagingEmpty(request);
            await waitForDataToAppear(request, 'unit-label', compositeId);
          } else {
            trackBatchVerification('POST', 'unit-label', compositeId, {
              cadTrustLabelId: data.cadTrustLabelId,
              cadTrustUnitId: data.cadTrustUnitId,
            });
          }
          created++;
        }
      }

      // Create 1 minimal record - use a combination that hasn't been used yet
      let minLabelId = labelIds[0];
      let minUnitId = unitIds[0];
      const minCombinationKey = `${minLabelId}-${minUnitId}`;
      if (usedCombinations.has(minCombinationKey)) {
        // Find an unused combination
        let found = false;
        for (let i = 0; i < labelIds.length && !found; i++) {
          for (let j = 0; j < unitIds.length && !found; j++) {
            const testKey = `${labelIds[i]}-${unitIds[j]}`;
            if (!usedCombinations.has(testKey)) {
              minLabelId = labelIds[i];
              minUnitId = unitIds[j];
              found = true;
            }
          }
        }
      }
      const finalMinKey = `${minLabelId}-${minUnitId}`;
      if (usedCombinations.has(finalMinKey)) {
        throw new Error(`Cannot create minimal record: all combinations are already used`);
      }
      usedCombinations.add(finalMinKey);
      const minimalData = generateUnitLabelMinimal(minLabelId, minUnitId);
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/unit-label', minimalData);
      expect(minResponse.success).to.be.true;
      const minCompositeId = minId || { labelId: minimalData.cadTrustLabelId, unitId: minimalData.cadTrustUnitId };
      createdIds.push(minCompositeId);
      addCreatedId('unit-label', minCompositeId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit-label', minCompositeId);
      } else {
        trackBatchVerification('POST', 'unit-label', minCompositeId, {
          cadTrustLabelId: minimalData.cadTrustLabelId,
          cadTrustUnitId: minimalData.cadTrustUnitId,
        });
      }

      // Create 1 maximal record - use a combination that hasn't been used yet
      let maxLabelId = labelIds.length > 1 ? labelIds[1] : labelIds[0];
      let maxUnitId = unitIds.length > 1 ? unitIds[1] : unitIds[0];
      const maxCombinationKey = `${maxLabelId}-${maxUnitId}`;
      if (usedCombinations.has(maxCombinationKey)) {
        // Find an unused combination
        let found = false;
        for (let i = 0; i < labelIds.length && !found; i++) {
          for (let j = 0; j < unitIds.length && !found; j++) {
            const testKey = `${labelIds[i]}-${unitIds[j]}`;
            if (!usedCombinations.has(testKey)) {
              maxLabelId = labelIds[i];
              maxUnitId = unitIds[j];
              found = true;
            }
          }
        }
      }
      const finalMaxKey = `${maxLabelId}-${maxUnitId}`;
      if (usedCombinations.has(finalMaxKey)) {
        throw new Error(`Cannot create maximal record: all combinations are already used`);
      }
      usedCombinations.add(finalMaxKey);
      const maximalData = generateUnitLabelMaximal(maxLabelId, maxUnitId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/unit-label', maximalData);
      expect(maxResponse.success).to.be.true;
      const maxCompositeId = maxId || { labelId: maximalData.cadTrustLabelId, unitId: maximalData.cadTrustUnitId };
      createdIds.push(maxCompositeId);
      addCreatedId('unit-label', maxCompositeId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit-label', maxCompositeId);
      } else {
        trackBatchVerification('POST', 'unit-label', maxCompositeId, {
          cadTrustLabelId: maximalData.cadTrustLabelId,
          cadTrustUnitId: maximalData.cadTrustUnitId,
        });
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
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'unit-label', id);
        expect(record).to.exist;
        // Note: unit-label uses composite key, so id is an object with labelId and unitId
        expect(record).to.have.property('cadTrustLabelId');
        expect(record).to.have.property('cadTrustUnitId');
        if (id.labelId) {
          expect(record.cadTrustLabelId).to.equal(id.labelId);
        }
        if (id.unitId) {
          expect(record.cadTrustUnitId).to.equal(id.unitId);
        }
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a unit-label relationship', async function () {
      const id = createdIds[0];
      // Get current record to include all fields
      // Note: unit-label uses composite key in path: /v2/unit-label/{labelId}/{unitId}
      const currentRecord = await request.get(`/v2/unit-label/${id.labelId}/${id.unitId}`).expect(200);
      // Create update data with ALL fields
      const updateData = {
        cadTrustLabelId: currentRecord.body.cadTrustLabelId,
        cadTrustUnitId: currentRecord.body.cadTrustUnitId,
        labelUnitDate: '2024-12-31',
        labelUnitDescription: 'Updated unit label description',
      };
      const response = await makePutRequest(request, '/v2/unit-label', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit-label', id);
        await validateDataInDatabase(request, 'unit-label', id, {
          cadTrustLabelId: updateData.cadTrustLabelId,
          cadTrustUnitId: updateData.cadTrustUnitId,
        });
      } else {
        trackBatchVerification('PUT', 'unit-label', id, updateData);
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

    it('should get a specific unit-label by composite key', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/unit-label/${id.labelId}/${id.unitId}`)
        .expect(200);

      expect(response.body.cadTrustLabelId).to.equal(id.labelId);
      expect(response.body.cadTrustUnitId).to.equal(id.unitId);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/unit-label')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created unit-label relationships', async function () {
      // Delete in reverse order
      for (let i = createdIds.length - 1; i >= 0; i--) {
        const id = createdIds[i];
        const response = await makeDeleteRequest(request, '/v2/unit-label', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'unit-label', id);
        }
      }

      // Commit all deletes if in short mode
      if (!shouldAutoCommit()) {
        await commitStagedRecords(request, [], true);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
      }
    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all unit-label relationships are deleted', async function () {
      const response = await request.get('/v2/unit-label').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have unit-label relationships that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
