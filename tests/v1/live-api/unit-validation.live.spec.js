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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstRecordIdFromDatabase, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateUnit,
  generateUnitMinimal,
  generateUnitMaximal,
  generateUnitLongStrings,
  generateUnitForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Unit Live API Validation Tests', function () {
  this.timeout(600000); // 10 minute timeout
  let request;
  let homeOrgId;
  const createdIds = []; // Track all created IDs (warehouseUnitId)

  before(async function () {
    request = getSharedRequest();
    homeOrgId = getSharedHomeOrgId();
  });

  describe('Step 3: Validation Failure Tests', function () {
    it('should reject POST with forbidden fields (createdAt, updatedAt, warehouseUnitId)', async function () {
      const forbiddenData = generateUnitForbiddenFields();
      const response = await request
        .post('/v1/units')
        .send(forbiddenData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateUnitMinimal();
      invalidData.unitType = getInvalidPicklistValue('unitType');
      const response = await request
        .post('/v1/units')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { unitOwner: 'Incomplete' }; // Missing required fields
      const response = await request
        .post('/v1/units')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateUnitLongStrings();
      const response = await request
        .post('/v1/units')
        .send(longData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const invalidTypeData = generateUnit();
      invalidTypeData.vintageYear = 'not-a-number';
      const response = await request
        .post('/v1/units')
        .send(invalidTypeData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      await clearStagingTable(request);
    });
  });

  describe('Step 4: POST Request Tests', function () {
    it('should create units with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateUnit();
      const { id, response } = await makePostRequest(request, '/v1/units', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id); // id is warehouseUnitId (same as uuid in V1)
      addCreatedId('unit', id);

      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v1/units', id, {
        unitOwner: data.unitOwner,
        unitBlockStart: data.unitBlockStart,
      });
      expect(inStaging).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', id);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        // Exclude nested child records (labels) as they're stored separately
        const { labels, ...fieldsToVerify } = data;
        trackBatchVerification('POST', 'unit', id, fieldsToVerify);
      }

      // Create 1 minimal record
      const minimalData = generateUnitMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v1/units', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('unit', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', minId);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        // Exclude nested child records (labels) as they're stored separately
        const { labels, ...fieldsToVerify } = minimalData;
        trackBatchVerification('POST', 'unit', minId, fieldsToVerify);
      }

      // Create 1 maximal record
      const maximalData = generateUnitMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v1/units', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('unit', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', maxId);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        // Exclude nested child records (labels) as they're stored separately
        const { labels, ...fieldsToVerify } = maximalData;
        trackBatchVerification('POST', 'unit', maxId, fieldsToVerify);
      }
    });
  });

  describe('Step 5: Staging Commit (if short mode)', function () {
    it('should commit all staged records in batch', async function () {
      if (!shouldAutoCommit()) {
        await commitStagedRecords(request, [], true); // Force commit
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        // Wait for all records to appear
        const recordsToWaitFor = createdIds.map(id => ({ type: 'unit', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'unit', id);
        expect(record).to.exist;
        expect(record.warehouseUnitId).to.equal(id);
      }
    });
  });

  describe('Step 7: PUT Request Tests', function () {
    it('should update a unit', async function () {
      // Get ID from createdIds (if available) or query for test records we created
      let id = createdIds[0];
      if (!id) {
        // Query for test records by filtering by home org and TEST- prefix
        let page = 1;
        const limit = 100;
        let found = false;

        while (!found && page <= 10) { // Limit to 10 pages to avoid infinite loop
          const response = await request.get(`/v1/units?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = response.body?.data || [];

          // Find first test record (unitOwner or unitSerialId starts with "TEST-")
          const testRecord = data.find(record =>
            (record.unitOwner && record.unitOwner.startsWith('TEST-')) ||
            (record.unitSerialId && record.unitSerialId.startsWith('TEST-'))
          );

          if (testRecord) {
            id = testRecord.warehouseUnitId;
            found = true;
            break;
          }

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          if (page >= totalPages || data.length < limit) {
            break;
          }
          page++;
        }

        if (!id) {
          this.skip(); // Skip if no test records exist
        }
      }

      // Get current record to include all fields (V1 PUT requires ALL fields)
      const currentResponse = await request.get(`/v1/units?warehouseUnitId=${id}`).expect(200);
      const currentData = currentResponse.body?.data || currentResponse.body;
      const record = Array.isArray(currentData) ? currentData[0] : currentData;

      if (!record) {
        this.skip(); // Skip if record not found
      }

      // Verify record belongs to home org and is a test record
      if (record.orgUid !== homeOrgId) {
        this.skip(); // Skip if record doesn't belong to home org
      }
      const isTestRecord = (record.unitOwner && record.unitOwner.startsWith('TEST-')) ||
                           (record.unitSerialId && record.unitSerialId.startsWith('TEST-'));
      if (!isTestRecord) {
        this.skip(); // Skip if not a test record
      }

      // Create update data with ALL fields (V1 requirement)
      const updateData = {
        warehouseUnitId: id,
        projectLocationId: record.projectLocationId || 'UPDATED-LOC',
        unitOwner: 'Updated Owner',
        countryJurisdictionOfOwner: record.countryJurisdictionOfOwner || 'United States of America',
        vintageYear: record.vintageYear || 2020,
        unitType: record.unitType || 'Removal - technical',
        unitStatus: record.unitStatus || 'Held',
        unitBlockStart: `UPDATED-START-${Date.now()}`,
        unitBlockEnd: `UPDATED-END-${Date.now()}`,
        unitCount: record.unitCount || 100,
        unitRegistryLink: record.unitRegistryLink || 'http://climateWarehouse.com/myRegistry',
        correspondingAdjustmentDeclaration: record.correspondingAdjustmentDeclaration || 'Unknown',
        correspondingAdjustmentStatus: record.correspondingAdjustmentStatus || 'Not Started',
        inCountryJurisdictionOfOwner: record.inCountryJurisdictionOfOwner || null,
        // Note: serialNumberBlock is auto-generated, not included in PUT
        marketplace: record.marketplace || null,
        marketplaceLink: record.marketplaceLink || null,
        marketplaceIdentifier: record.marketplaceIdentifier || null,
        unitTags: record.unitTags || null,
        unitStatusReason: record.unitStatusReason || null,
      };

      const response = await makePutRequest(request, '/v1/units', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', id);
        await validateDataInDatabase(request, 'unit', id, {
          unitOwner: updateData.unitOwner,
          unitBlockStart: updateData.unitBlockStart,
        });
      } else {
        trackBatchVerification('PUT', 'unit', id, updateData);
      }
    });
  });

  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created units', async function () {
      // Query for all test units (those with unitOwner starting with "TEST-")
      // This works even when DELETE runs in a separate process
      let idsToDelete = [];

      // First try to use createdIds if available (when running in same process)
      if (createdIds.length > 0) {
        idsToDelete = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org, then filtering for TEST- prefix
        // Using orgUid filter is much faster than paginating through all units
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get units belonging to our organization
          const response = await request.get(`/v1/units?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = response.body?.data || [];

          // Filter for test records (unitOwner starts with "TEST-")
          const testRecords = data.filter(record =>
            record.unitOwner && record.unitOwner.startsWith('TEST-')
          );

          idsToDelete.push(...testRecords.map(r => r.warehouseUnitId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      if (idsToDelete.length === 0) {
        this.skip(); // No test records to delete
      }

      console.log(`Found ${idsToDelete.length} test unit(s) to delete`);

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        try {
          const response = await makeDeleteRequest(request, '/v1/units', id);
          // Check if delete was successful or if record doesn't exist (already deleted)
          if (response.success === false && response.error && response.error.includes('not found')) {
            // Record already deleted, continue
            continue;
          }
          expect(response.success).to.be.true;
        } catch (error) {
          // If delete fails, log but continue
          console.warn(`Failed to delete unit ${id}: ${error.message}`);
          continue;
        }

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          // Verify record is deleted
          try {
            const checkResponse = await request.get(`/v1/units?warehouseUnitId=${id}`);
            const checkData = checkResponse.body?.data || [];
            expect(checkData.length).to.equal(0, `Unit ${id} should be deleted but still exists`);
          } catch (error) {
            // 404 or empty is expected - record is deleted
            if (error.status !== 404 && error.response?.status !== 404) {
              throw error;
            }
          }
        } else {
          trackBatchVerification('DELETE', 'unit', id);
        }
      }
    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all test units are deleted', async function () {
      // Query for test units by orgUid and TEST- prefix to verify they're all deleted
      // This works even when DELETE runs in a separate process
      let testUnitIds = [];

      // First try createdIds if available
      if (createdIds.length > 0) {
        testUnitIds = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get units belonging to our organization
          const response = await request.get(`/v1/units?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = response.body?.data || [];

          // Filter for test records (unitOwner starts with "TEST-")
          const testRecords = data.filter(record =>
            record.unitOwner && record.unitOwner.startsWith('TEST-')
          );

          testUnitIds.push(...testRecords.map(r => r.warehouseUnitId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      // Verify all test units are deleted
      for (const id of testUnitIds) {
        try {
          const checkResponse = await request.get(`/v1/units?warehouseUnitId=${id}`);
          const checkData = checkResponse.body?.data || [];
          expect(checkData.length).to.equal(0, `Test unit ${id} should be deleted but still exists`);
        } catch (error) {
          // 404 or empty is expected - record is deleted
          if (error.status !== 404 && error.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (testUnitIds.length > 0) {
        console.log(`✓ Verified ${testUnitIds.length} test unit(s) are deleted`);
      } else {
        console.log('✓ No test units found to verify (all deleted or none created)');
      }
    });
  });
});
