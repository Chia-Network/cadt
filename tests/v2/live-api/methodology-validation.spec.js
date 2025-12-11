import { expect } from 'chai';
import {
  getLiveApiRequest,
  getHomeOrgId,
  commitStagedRecords,
  waitForBatchToAppear,
  waitForPendingCommits,
  checkDatabaseEmpty,
} from './helpers/live-api-helpers.js';
import { addCreatedId } from './helpers/shared-state.js';
import {
  generateMethodology,
  generateMethodologyMinimal,
  generateMethodologyMaximal,
  generateMethodologyLongStrings,
  generateMethodologyInvalidPicklist,
  generateMethodologyForbiddenFields,
  generateLargeDataset,
  getLongString,
  getInvalidPicklistValue,
  getNonExistentId,
} from './data/test-data-generators.js';

describe('Methodology Live API Validation Tests', function () {
  this.timeout(600000); // 10 minute timeout (longer due to blockchain waits)

  let request;
  let homeOrgId;
  const createdIds = []; // Track all created IDs for cleanup
  const stagedUuids = []; // Track staged UUIDs for batch commit

  before(async function () {
    request = await getLiveApiRequest();
    homeOrgId = await getHomeOrgId(request);
    // Optional: Check database is empty (warns if not, doesn't fail)
    await checkDatabaseEmpty(request);
  });

  describe('POST /v2/methodology - Happy Path Tests', function () {
    it('should create multiple methodologies with different variants and batch commit', async function () {
      const recordsToWaitFor = [];

      // Create 3 methodologies with standard data
      for (let i = 0; i < 3; i++) {
        const data = generateMethodology();
        data.methodologyCode = `${data.methodologyCode}-${i}`;
        const response = await request
          .post('/v2/methodology')
          .send(data)
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.cadTrustMethodologyId).to.exist;
        expect(response.body.uuid).to.exist;

        createdIds.push(response.body.cadTrustMethodologyId);
        addCreatedId('methodology', response.body.cadTrustMethodologyId);
        stagedUuids.push(response.body.uuid);
        recordsToWaitFor.push({
          type: 'methodology',
          id: response.body.cadTrustMethodologyId,
        });
      }

      // Create 1 methodology with minimal required fields only
      const minimalData = generateMethodologyMinimal();
      minimalData.methodologyCode = `${minimalData.methodologyCode}-minimal`;
      const minimalResponse = await request
        .post('/v2/methodology')
        .send(minimalData)
        .expect(200);

      expect(minimalResponse.body.success).to.be.true;
      createdIds.push(minimalResponse.body.cadTrustMethodologyId);
      addCreatedId('methodology', minimalResponse.body.cadTrustMethodologyId);
      stagedUuids.push(minimalResponse.body.uuid);
      recordsToWaitFor.push({
        type: 'methodology',
        id: minimalResponse.body.cadTrustMethodologyId,
      });

      // Create 1 methodology with all fields populated (maximal)
      const maximalData = generateMethodologyMaximal();
      maximalData.methodologyCode = `${maximalData.methodologyCode}-maximal`;
      const maximalResponse = await request
        .post('/v2/methodology')
        .send(maximalData)
        .expect(200);

      expect(maximalResponse.body.success).to.be.true;
      createdIds.push(maximalResponse.body.cadTrustMethodologyId);
      addCreatedId('methodology', maximalResponse.body.cadTrustMethodologyId);
      stagedUuids.push(maximalResponse.body.uuid);
      recordsToWaitFor.push({
        type: 'methodology',
        id: maximalResponse.body.cadTrustMethodologyId,
      });

      // Create 1 methodology with long string values
      const longStringData = generateMethodologyLongStrings();
      longStringData.methodologyCode = `LONG-${Date.now()}`;
      const longStringResponse = await request
        .post('/v2/methodology')
        .send(longStringData)
        .expect(200);

      expect(longStringResponse.body.success).to.be.true;
      createdIds.push(longStringResponse.body.cadTrustMethodologyId);
      addCreatedId('methodology', longStringResponse.body.cadTrustMethodologyId);
      stagedUuids.push(longStringResponse.body.uuid);
      recordsToWaitFor.push({
        type: 'methodology',
        id: longStringResponse.body.cadTrustMethodologyId,
      });

      // Batch commit all 6 staged records
      await commitStagedRecords(request, stagedUuids);
      stagedUuids.length = 0; // Clear array

      // Wait for blockchain transaction and data to appear in database
      console.log('Waiting for blockchain sync...');
      await waitForBatchToAppear(request, recordsToWaitFor);
      console.log('Blockchain sync complete!');

      // Verify all records are now in the database
      for (const record of recordsToWaitFor) {
        const getResponse = await request
          .get(`/v2/methodology/${record.id}`)
          .expect(200);
        expect(getResponse.body.cadTrustMethodologyId).to.equal(record.id);
      }

      // Verify long strings are preserved correctly
      const longStringRecord = await request
        .get(`/v2/methodology/${longStringResponse.body.cadTrustMethodologyId}`)
        .expect(200);
      expect(longStringRecord.body.methodologyName).to.have.length.at.least(1000);
    });
  });

  describe('GET /v2/methodology', function () {
    it('should list all methodologies', async function () {
      const response = await request
        .get('/v2/methodology')
        .expect(200);

      expect(response.body).to.be.an('array');
      // Since database is empty (except home org), we can verify exact count
      // after our records are committed and synced
      expect(response.body.length).to.equal(createdIds.length);
    });

    it('should get a specific methodology by ID', async function () {
      // Use an ID from createdIds (must have been committed and synced)
      const id = createdIds[0];
      const response = await request
        .get(`/v2/methodology/${id}`)
        .expect(200);

      expect(response.body.cadTrustMethodologyId).to.equal(id);
      expect(response.body.methodologyCode).to.exist;
      expect(response.body.methodologyName).to.exist;
    });
  });

  describe('PUT /v2/methodology/:id', function () {
    it('should update a methodology and batch commit', async function () {
      const id = createdIds[0];
      // Get current record to include all fields (V2 requires ALL fields in update)
      const currentRecord = await request
        .get(`/v2/methodology/${id}`)
        .expect(200);

      // Create update data with ALL fields (V2 pattern)
      const updateData = {
        methodologyCode: `UPDATED-${Date.now()}`,
        methodologyName: 'Updated Methodology Name',
        methodologyVersion: currentRecord.body.methodologyVersion || null,
        methodologyDate: currentRecord.body.methodologyDate || null,
        methodologyLink: currentRecord.body.methodologyLink || null,
        methodologyType: currentRecord.body.methodologyType || null,
      };

      const response = await request
        .put(`/v2/methodology/${id}`)
        .send(updateData);

      if (response.status !== 200) {
        console.error('PUT error response:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;

      // Commit all uncommitted staging records (no need to specify UUIDs)
      await commitStagedRecords(request, []);
      await waitForBatchToAppear(request, [{ type: 'methodology', id }]);

      // Verify update
      const getResponse = await request
        .get(`/v2/methodology/${id}`)
        .expect(200);
      expect(getResponse.body.methodologyCode).to.equal(updateData.methodologyCode);
      expect(getResponse.body.methodologyName).to.equal(updateData.methodologyName);
    });
  });

  describe('DELETE /v2/methodology/:id', function () {
    it('should delete a methodology and batch commit', async function () {
      const id = createdIds[createdIds.length - 1]; // Delete last one
      const response = await request
        .delete(`/v2/methodology/${id}`)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Commit all uncommitted staging records (no need to specify UUIDs)
      await commitStagedRecords(request, []);

      // Wait a bit for delete to sync, then verify record is gone
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      const getResponse = await request
        .get(`/v2/methodology/${id}`)
        .expect(404); // Should be deleted

      createdIds.pop(); // Remove from tracking
    });
  });

  describe('POST /v2/methodology - Error Case Tests', function () {
    // Wait for any pending commits to complete before running error tests
    before(async function () {
      await waitForPendingCommits(request);
    });

    it('should reject methodology with missing required field (methodologyCode)', async function () {
      const invalidData = {
        methodologyName: 'Missing Code',
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (response.body.error) {
        expect(response.body.error.toLowerCase()).to.include('methodologycode');
      } else {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with missing required field (methodologyName)', async function () {
      const invalidData = {
        methodologyCode: 'TEST-CODE',
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (response.body.error) {
        expect(response.body.error.toLowerCase()).to.include('methodologyname');
      } else {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with invalid picklist value', async function () {
      const invalidData = generateMethodologyInvalidPicklist();

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (response.body.error) {
        // Error should mention validation or picklist
        const errorLower = response.body.error.toLowerCase();
        expect(
          errorLower.includes('methodologytype') || errorLower.includes('picklist') || errorLower.includes('validation')
        ).to.be.true;
      } else {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with forbidden fields (createdAt, updatedAt)', async function () {
      const invalidData = generateMethodologyForbiddenFields();

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (response.body.error) {
        expect(response.body.error.toLowerCase()).to.include('cannot be set via api');
      } else {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with forbidden ID field (cadTrustMethodologyId)', async function () {
      const invalidData = {
        methodologyCode: 'TEST-CODE',
        methodologyName: 'Test Name',
        cadTrustMethodologyId: getNonExistentId(),
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (response.body.error) {
        expect(response.body.error.toLowerCase()).to.include('auto-generated');
      } else {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with unknown fields', async function () {
      const invalidData = {
        methodologyCode: 'TEST-CODE',
        methodologyName: 'Test Name',
        unknownField: 'should not be allowed',
        anotherUnknownField: 123,
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (!response.body.error) {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with invalid data types', async function () {
      const invalidData = {
        methodologyCode: 12345, // Should be string
        methodologyName: 'Test Name',
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (!response.body.error) {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with invalid date format', async function () {
      const invalidData = {
        methodologyCode: 'TEST-CODE',
        methodologyName: 'Test Name',
        methodologyDate: 'not-a-date',
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (!response.body.error) {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });

    it('should reject methodology with invalid URL format', async function () {
      const invalidData = {
        methodologyCode: 'TEST-CODE',
        methodologyName: 'Test Name',
        methodologyLink: 'not-a-valid-url',
      };

      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      if (!response.body.error) {
        console.log('Error response body:', JSON.stringify(response.body, null, 2));
        throw new Error('Expected error field in response body');
      }
    });
  });

  // Clean up any remaining staged records before moving to next test file
  after(async function () {
    if (stagedUuids.length > 0) {
      await commitStagedRecords(request, stagedUuids);
    }
  });
});
