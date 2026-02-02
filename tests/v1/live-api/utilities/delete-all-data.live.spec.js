import { expect } from 'chai';
import {
  getLiveApiRequest,
  getHomeOrgId,
  commitStagedRecords,
  waitForStagingEmpty,
  clearStagingTable,
} from '../helpers/live-api-helpers.js';

/**
 * Check if a record is test data created by our test generators
 * Test data uses TEST- prefix patterns
 */
const isTestRecord = (resourceName, record) => {
  if (resourceName === 'projects') {
    // Test projects use projectId starting with TEST-PROJ- or TEST-MIN-PROJ-
    const projectId = record.projectId || '';
    return projectId.startsWith('TEST-PROJ-') || projectId.startsWith('TEST-MIN-PROJ-');
  } else if (resourceName === 'units') {
    // Test units use projectLocationId starting with TEST-LOC- or TEST-MIN-LOC-
    // or unitOwner starting with TEST-OWNER- or TEST-MIN-OWNER-
    const projectLocationId = record.projectLocationId || '';
    const unitOwner = record.unitOwner || '';
    return (
      projectLocationId.startsWith('TEST-LOC-') ||
      projectLocationId.startsWith('TEST-MIN-LOC-') ||
      unitOwner.startsWith('TEST-OWNER-') ||
      unitOwner.startsWith('TEST-MIN-OWNER-')
    );
  }
  return false;
};

describe('Delete V1 Test Data', function () {
  this.timeout(600000); // 10 minute timeout

  let request;
  let homeOrgId;

  before(async function () {
    request = await getLiveApiRequest();
    homeOrgId = await getHomeOrgId(request);
  });

  it('should delete only test data (TEST- prefix) from V1 tables using API DELETE requests', async function () {
    // Step 1: Clear staging table first before doing anything
    console.log('Clearing staging table...');
    await clearStagingTable(request);
    console.log('✓ Staging table cleared\n');

    // Define V1 resource types and their endpoints
    // V1 has fewer resources than V2: mainly projects and units with their child tables
    // V1 endpoints require page and limit query parameters
    const resourceTypes = [
      {
        name: 'units',
        getEndpoint: '/v1/units?page=1&limit=1000',
        getIdFromRecord: (record) => record.warehouseUnitId,
        deleteEndpoint: (id) => `/v1/units`,
        deleteBody: (id) => ({ warehouseUnitId: id }),
      },
      {
        name: 'projects',
        getEndpoint: '/v1/projects?page=1&limit=1000',
        getIdFromRecord: (record) => record.warehouseProjectId,
        deleteEndpoint: (id) => `/v1/projects`,
        deleteBody: (id) => ({ warehouseProjectId: id }),
      },
    ];

    // Delete in reverse dependency order (units before projects)
    const deleteOrder = ['units', 'projects'];

    const resourceMap = {};
    for (const resource of resourceTypes) {
      resourceMap[resource.name] = resource;
    }

    // Step 2: GET all records from each table
    console.log('Fetching all records from V1 data tables...');
    console.log('(Only records with TEST- prefix patterns will be deleted)\n');
    const allRecordsToDelete = [];

    for (const resourceName of deleteOrder) {
      const resource = resourceMap[resourceName];
      if (!resource) {
        console.warn(`⚠️  Unknown resource type: ${resourceName}, skipping`);
        continue;
      }

      try {
        const getResponse = await request.get(resource.getEndpoint);
        if (getResponse.status !== 200) {
          console.error(`❌ Error fetching ${resourceName}: ${getResponse.status} - ${JSON.stringify(getResponse.body)}`);
          continue;
        }
        // V1 returns paginated data: { page, pageCount, data: [...] }
        const records = getResponse.body.data || getResponse.body || [];

        if (!Array.isArray(records) || records.length === 0) {
          console.log(`  ${resourceName}: 0 records total, 0 test records`);
          continue;
        }

        // Filter to only test records
        const testRecords = records.filter((record) => isTestRecord(resourceName, record));
        console.log(`  ${resourceName}: ${records.length} record(s) total, ${testRecords.length} test record(s)`);

        for (const record of testRecords) {
          const id = resource.getIdFromRecord(record);
          if (id) {
            allRecordsToDelete.push({
              resourceName,
              resource,
              id,
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching ${resourceName}: ${error.message}`);
        // Continue with other resources
      }
    }

    if (allRecordsToDelete.length === 0) {
      console.log('No test records found to delete');
      return;
    }

    console.log(`\nFound ${allRecordsToDelete.length} test records to delete`);

    // Step 3: Stage all DELETE requests
    console.log('\nStaging DELETE requests...');
    let deleteCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const { resourceName, resource, id } of allRecordsToDelete) {
      try {
        const deleteEndpoint = resource.deleteEndpoint(id);
        const deleteBody = resource.deleteBody(id);

        // V1 DELETE requests use body with warehouseProjectId or warehouseUnitId
        const deleteResponse = await request
          .delete(deleteEndpoint)
          .send(deleteBody)
          .expect(200);

        expect(deleteResponse.body.success).to.be.true;
        deleteCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to delete ${resourceName}/${id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
        // Continue with other deletes even if one fails
      }
    }

    console.log(`✓ Staged ${deleteCount} deletes${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);

    if (errors.length > 0) {
      console.error('\nDelete errors:');
      errors.forEach(err => console.error(`  - ${err}`));
    }

    // Step 4: Commit all staged deletes in one batch
    console.log('\nCommitting all staged deletes...');
    await commitStagedRecords(request, [], true); // force=true to always commit

    // Step 5: Wait for staging table to be empty (truncated)
    // This indicates the commit has been processed and data has synced
    await waitForStagingEmpty(request);

    // Step 6: Verify all records are deleted
    console.log('\nVerifying all records are deleted...');
    const verifyErrors = [];

    for (const { resourceName, resource, id } of allRecordsToDelete) {
      try {
        // V1 uses query params to get by ID
        let verifyEndpoint;
        if (resourceName === 'projects') {
          verifyEndpoint = `/v1/projects?warehouseProjectId=${id}`;
        } else if (resourceName === 'units') {
          verifyEndpoint = `/v1/units?warehouseUnitId=${id}`;
        } else {
          continue;
        }

        const getResponse = await request.get(verifyEndpoint);

        if (getResponse.status === 200) {
          const data = getResponse.body?.data || getResponse.body;
          // Check if record exists
          if (Array.isArray(data) && data.length > 0) {
            verifyErrors.push(`${resourceName}/${id} still exists`);
          } else if (data && typeof data === 'object' && Object.keys(data).length > 0 && data.warehouseProjectId) {
            verifyErrors.push(`${resourceName}/${id} still exists`);
          }
          // If data is empty array or empty object, record was deleted successfully
        }
        // If status is not 200 (like 404), record doesn't exist - deletion successful
      } catch (error) {
        // If we get an error (like 404), the record doesn't exist - that's good
        const status = error.response?.status || error.status;
        if (status && status !== 404) {
          verifyErrors.push(`${resourceName}/${id} verification error: ${error.message} (status: ${status})`);
        }
      }
    }

    if (verifyErrors.length > 0) {
      console.error('\n❌ Verification errors - some records still exist:');
      verifyErrors.forEach(err => console.error(`  - ${err}`));
      throw new Error(`${verifyErrors.length} records still exist after deletion`);
    }

    console.log(`\n✓ Successfully deleted and verified ${deleteCount} test records`);
  });
});
