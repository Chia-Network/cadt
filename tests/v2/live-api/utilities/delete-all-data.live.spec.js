import { expect } from 'chai';
import {
  getLiveApiRequest,
  getHomeOrgId,
  commitStagedRecords,
  waitForStagingEmpty,
  clearStagingTable,
} from '../helpers/live-api-helpers.js';

describe('Delete All Test Data', function () {
  this.timeout(600000); // 10 minute timeout

  let request;
  let homeOrgId;

  before(async function () {
    request = await getLiveApiRequest();
    homeOrgId = await getHomeOrgId(request);
  });

  it('should delete all data from all tables using API DELETE requests', async function () {
    // Step 1: Clear staging table first before doing anything
    console.log('Clearing staging table...');
    await clearStagingTable(request);
    console.log('✓ Staging table cleared\n');

    // Define all resource types and their GET/DELETE endpoints
    const resourceTypes = [
      {
        name: 'unit-label',
        getEndpoint: '/v2/unit-label',
        getIdFromRecord: (record) => record.cadTrustUnitLabelId,
        deleteEndpoint: (id) => `/v2/unit-label/${id}`,
        verifyEndpoint: (id) => `/v2/unit-label/${id}`,
      },
      {
        name: 'stakeholder-projects',
        getEndpoint: '/v2/stakeholder-projects',
        getIdFromRecord: (record) => record.cadTrustStakeholderProjectId,
        deleteEndpoint: (id) => `/v2/stakeholder-projects/${id}`,
        verifyEndpoint: (id) => `/v2/stakeholder-projects/${id}`,
      },
      {
        name: 'project-methodology',
        getEndpoint: '/v2/project-methodology',
        getIdFromRecord: (record) => record.cadTrustProjectMethodologyId,
        deleteEndpoint: (id) => `/v2/project-methodology/${id}`,
        verifyEndpoint: (id) => `/v2/project-methodology/${id}`,
      },
      {
        name: 'unit',
        getEndpoint: '/v2/unit',
        getIdFromRecord: (record) => record.cadTrustUnitId,
        deleteEndpoint: (id) => `/v2/unit/${id}`,
        verifyEndpoint: (id) => `/v2/unit/${id}`,
      },
      {
        name: 'issuance',
        getEndpoint: '/v2/issuance',
        getIdFromRecord: (record) => record.cadTrustIssuanceId,
        deleteEndpoint: (id) => `/v2/issuance/${id}`,
        verifyEndpoint: (id) => `/v2/issuance/${id}`,
      },
      {
        name: 'verification',
        getEndpoint: '/v2/verification',
        getIdFromRecord: (record) => record.cadTrustVerificationId,
        deleteEndpoint: (id) => `/v2/verification/${id}`,
        verifyEndpoint: (id) => `/v2/verification/${id}`,
      },
      {
        name: 'validation',
        getEndpoint: '/v2/validation',
        getIdFromRecord: (record) => record.cadTrustValidationId,
        deleteEndpoint: (id) => `/v2/validation/${id}`,
        verifyEndpoint: (id) => `/v2/validation/${id}`,
      },
      {
        name: 'aef-t4-holdings',
        getEndpoint: '/v2/aef-t4-holdings',
        getIdFromRecord: (record) => record.cadTrustAefT4HoldingsId,
        deleteEndpoint: (id) => `/v2/aef-t4-holdings/${id}`,
        verifyEndpoint: (id) => `/v2/aef-t4-holdings/${id}`,
      },
      {
        name: 'aef-t3-actions',
        getEndpoint: '/v2/aef-t3-actions',
        getIdFromRecord: (record) => record.cadTrustAefT3ActionsId,
        deleteEndpoint: (id) => `/v2/aef-t3-actions/${id}`,
        verifyEndpoint: (id) => `/v2/aef-t3-actions/${id}`,
      },
      {
        name: 'aef-t2-authorizations',
        getEndpoint: '/v2/aef-t2-authorizations',
        getIdFromRecord: (record) => record.cadTrustAefT2AuthorizationsId,
        deleteEndpoint: (id) => `/v2/aef-t2-authorizations/${id}`,
        verifyEndpoint: (id) => `/v2/aef-t2-authorizations/${id}`,
      },
      {
        name: 'aef-t5-authorized-entities',
        getEndpoint: '/v2/aef-t5-authorized-entities',
        getIdFromRecord: (record) => record.cadTrustAefT5AuthorizedEntitiesId,
        deleteEndpoint: (id) => `/v2/aef-t5-authorized-entities/${id}`,
        verifyEndpoint: (id) => `/v2/aef-t5-authorized-entities/${id}`,
      },
      {
        name: 'aef-t1-submission',
        getEndpoint: '/v2/aef-t1-submission',
        getIdFromRecord: (record) => record.cadTrustAefT1SubmissionId,
        deleteEndpoint: (id) => `/v2/aef-t1-submission/${id}`,
        verifyEndpoint: (id) => `/v2/aef-t1-submission/${id}`,
      },
      {
        name: 'co-benefit',
        getEndpoint: '/v2/co-benefit',
        getIdFromRecord: (record) => record.cadTrustCoBenefitId,
        deleteEndpoint: (id) => `/v2/co-benefit/${id}`,
        verifyEndpoint: (id) => `/v2/co-benefit/${id}`,
      },
      {
        name: 'estimation',
        getEndpoint: '/v2/estimation',
        getIdFromRecord: (record) => record.cadTrustEstimationId,
        deleteEndpoint: (id) => `/v2/estimation/${id}`,
        verifyEndpoint: (id) => `/v2/estimation/${id}`,
      },
      {
        name: 'rating',
        getEndpoint: '/v2/rating',
        getIdFromRecord: (record) => record.cadTrustRatingId,
        deleteEndpoint: (id) => `/v2/rating/${id}`,
        verifyEndpoint: (id) => `/v2/rating/${id}`,
      },
      {
        name: 'label',
        getEndpoint: '/v2/label',
        getIdFromRecord: (record) => record.cadTrustLabelId,
        deleteEndpoint: (id) => `/v2/label/${id}`,
        verifyEndpoint: (id) => `/v2/label/${id}`,
      },
      {
        name: 'stakeholder',
        getEndpoint: '/v2/stakeholder',
        getIdFromRecord: (record) => record.cadTrustStakeholderId,
        deleteEndpoint: (id) => `/v2/stakeholder/${id}`,
        verifyEndpoint: (id) => `/v2/stakeholder/${id}`,
      },
      {
        name: 'project',
        getEndpoint: '/v2/project',
        getIdFromRecord: (record) => record.cadTrustProjectId,
        deleteEndpoint: (id) => `/v2/project/${id}`,
        verifyEndpoint: (id) => `/v2/project/${id}`,
      },
      {
        name: 'program',
        getEndpoint: '/v2/program',
        getIdFromRecord: (record) => record.cadTrustProgramId,
        deleteEndpoint: (id) => `/v2/program/${id}`,
        verifyEndpoint: (id) => `/v2/program/${id}`,
      },
      {
        name: 'methodology',
        getEndpoint: '/v2/methodology',
        getIdFromRecord: (record) => record.cadTrustMethodologyId,
        deleteEndpoint: (id) => `/v2/methodology/${id}`,
        verifyEndpoint: (id) => `/v2/methodology/${id}`,
      },
      {
        name: 'location',
        getEndpoint: '/v2/location',
        getIdFromRecord: (record) => record.cadTrustLocationId,
        deleteEndpoint: (id) => `/v2/location/${id}`,
        verifyEndpoint: (id) => `/v2/location/${id}`,
      },
    ];

    // Delete in reverse dependency order
    const deleteOrder = [
      'unit-label',
      'stakeholder-projects',
      'project-methodology',
      'unit',
      'issuance',
      'verification',
      'validation',
      'aef-t4-holdings',
      'aef-t3-actions',
      'aef-t2-authorizations',
      'aef-t5-authorized-entities',
      'aef-t1-submission',
      'co-benefit',
      'estimation',
      'rating',
      'label',
      'stakeholder',
      'project',
      'program',
      'methodology',
      'location',
    ];

    const resourceMap = {};
    for (const resource of resourceTypes) {
      resourceMap[resource.name] = resource;
    }

    // Step 2: GET all records from each table
    console.log('Fetching all records from data tables...');
    const allRecordsToDelete = [];

    for (const resourceName of deleteOrder) {
      const resource = resourceMap[resourceName];
      if (!resource) {
        console.warn(`⚠️  Unknown resource type: ${resourceName}, skipping`);
        continue;
      }

      try {
        const getResponse = await request.get(resource.getEndpoint).expect(200);
        const records = getResponse.body.data || getResponse.body || [];

        if (records.length === 0) {
          console.log(`  ${resourceName}: 0 records`);
          continue;
        }

        console.log(`  ${resourceName}: ${records.length} record(s)`);

        for (const record of records) {
          const id = resource.getIdFromRecord(record);
          allRecordsToDelete.push({
            resourceName,
            resource,
            id,
          });
        }
      } catch (error) {
        console.error(`❌ Error fetching ${resourceName}: ${error.message}`);
        // Continue with other resources
      }
    }

    if (allRecordsToDelete.length === 0) {
      console.log('No records found to delete');
      return;
    }

    console.log(`\nFound ${allRecordsToDelete.length} total records to delete`);

    // Step 3: Stage all DELETE requests
    console.log('\nStaging DELETE requests...');
    let deleteCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const { resourceName, resource, id } of allRecordsToDelete) {
      try {
        const deleteEndpoint = resource.deleteEndpoint(id);
        const deleteResponse = await request.delete(deleteEndpoint).expect(200);

        expect(deleteResponse.body.success).to.be.true;
        deleteCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to delete ${resourceName}/${JSON.stringify(id)}: ${error.message}`;
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
    await commitStagedRecords(request, []); // Empty array means commit all uncommitted records

    // Step 5: Wait for staging table to be empty (truncated)
    // This indicates the commit has been processed and data has synced
    await waitForStagingEmpty(request);

    // Step 6: Verify all records are deleted
    console.log('\nVerifying all records are deleted...');
    const verifyErrors = [];

    for (const { resourceName, resource, id } of allRecordsToDelete) {
      try {
        const verifyEndpoint = resource.verifyEndpoint(id);

        try {
          // Try to GET the record - if it exists, we'll get 200, if not, supertest will throw
          const getResponse = await request.get(verifyEndpoint).expect(200);
          // If we get here, the record still exists (should have been deleted)
          verifyErrors.push(`${resourceName}/${JSON.stringify(id)} still exists`);
        } catch (getError) {
          // supertest throws on non-2xx status codes
          // 404 is expected - record should not exist (deletion successful)
          // Check the actual status code
          const status = getError.response?.status || getError.status;
          if (status && status !== 404) {
            // Some other error occurred (not 404)
            verifyErrors.push(`${resourceName}/${JSON.stringify(id)} verification error: ${getError.message} (status: ${status})`);
          }
          // If status is 404, that's good - record was deleted successfully
        }
      } catch (error) {
        verifyErrors.push(`${resourceName}/${JSON.stringify(id)} verification error: ${error.message}`);
      }
    }

    if (verifyErrors.length > 0) {
      console.error('\n❌ Verification errors - some records still exist:');
      verifyErrors.forEach(err => console.error(`  - ${err}`));
      throw new Error(`${verifyErrors.length} records still exist after deletion`);
    }

    console.log(`\n✓ Successfully deleted and verified ${deleteCount} records`);
  });
});

