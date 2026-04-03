import { expect } from 'chai';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
  waitForDataToAppear,
} from './helpers/live-api-helpers.js';
import { runSharedSetup, getSharedRequest } from './helpers/shared-setup.js';
import {
  generateProgram,
  generateProject,
  generateMethodology,
  generateValidation,
  generateVerification,
  generateProjectMethodology,
  generateIssuance,
  generateUnit,
  generateLabel,
  generateUnitLabel,
  generateLocation,
  generateEstimation,
  generateRating,
  generateCoBenefit,
  generateStakeholder,
  generateStakeholderProjects,
} from './data/test-data-generators.js';

describe('Cascade Delete Live API Tests', function () {
  this.timeout(900000);

  let request;

  before(async function () {
    await runSharedSetup(true);
    request = getSharedRequest();
  });

  const postAndGetId = async (endpoint, data, idField) => {
    const response = await request.post(endpoint).send(data).expect(200);
    expect(response.body.success).to.equal(true);
    expect(response.body[idField]).to.exist;
    return response.body[idField];
  };

  const hasStagedDelete = (rows, table, key, value) => rows.some((row) => {
    if (row.table !== table || row.action !== 'DELETE') {
      return false;
    }
    const parsed = JSON.parse(row.data);
    return parsed[0]?.[key] === value;
  });

  it('should cascade delete project children through commit', async function () {
    const programId = await postAndGetId('/v2/program', generateProgram(), 'cadTrustProgramId');
    const projectId = await postAndGetId('/v2/project', generateProject(programId), 'cadTrustProjectId');
    const methodologyId = await postAndGetId('/v2/methodology', generateMethodology(), 'cadTrustMethodologyId');
    const validationId = await postAndGetId('/v2/validation', generateValidation(projectId), 'cadTrustValidationId');
    const verificationId = await postAndGetId('/v2/verification', generateVerification(projectId, validationId), 'cadTrustVerificationId');
    const projectMethodologyId = await postAndGetId('/v2/project-methodology', generateProjectMethodology(projectId, methodologyId), 'cadTrustProjectMethodologyId');
    const issuanceId = await postAndGetId('/v2/issuance', generateIssuance(verificationId, projectMethodologyId), 'cadTrustIssuanceId');
    const unitId = await postAndGetId('/v2/unit', generateUnit(issuanceId), 'cadTrustUnitId');
    const labelId = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const unitLabelId = await postAndGetId('/v2/unit-label', generateUnitLabel(labelId, unitId), 'cadTrustUnitLabelId');
    const locationId = await postAndGetId('/v2/location', generateLocation(projectId), 'cadTrustLocationId');
    const estimationId = await postAndGetId('/v2/estimation', generateEstimation(projectId), 'cadTrustEstimationId');
    const ratingId = await postAndGetId('/v2/rating', generateRating(projectId), 'cadTrustRatingId');
    const coBenefitId = await postAndGetId('/v2/co-benefit', generateCoBenefit(projectId), 'cadTrustCoBenefitId');
    const stakeholderId = await postAndGetId('/v2/stakeholder', generateStakeholder(), 'cadTrustStakeholderId');
    const stakeholderProjectId = await postAndGetId('/v2/stakeholder-projects', generateStakeholderProjects(stakeholderId, projectId), 'cadTrustStakeholderProjectId');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);

    await waitForDataToAppear(request, 'project', projectId);
    await waitForDataToAppear(request, 'unit-label', unitLabelId);

    const deleteResponse = await request.delete(`/v2/project/${projectId}`).expect(200);
    expect(deleteResponse.body.success).to.equal(true);
    expect(deleteResponse.body.stagedChildDeletes).to.equal(11);

    const stagingResponse = await request.get('/v2/staging').query({ page: 1, limit: 500 }).expect(200);
    const stagedRows = stagingResponse.body?.data || [];

    const expectedDeleteRows = [
      ['location', 'cad_trust_location_id', locationId],
      ['estimation', 'cad_trust_estimation_id', estimationId],
      ['rating', 'cad_trust_rating_id', ratingId],
      ['co_benefit', 'cad_trust_co_benefit_id', coBenefitId],
      ['validation', 'cad_trust_validation_id', validationId],
      ['verification', 'cad_trust_verification_id', verificationId],
      ['project_methodology', 'cad_trust_project_methodology_id', projectMethodologyId],
      ['stakeholder_projects', 'cad_trust_stakeholder_project_id', stakeholderProjectId],
      ['issuance', 'cad_trust_issuance_id', issuanceId],
      ['unit', 'cad_trust_unit_id', unitId],
      ['unit_label', 'cad_trust_unit_label_id', unitLabelId],
      ['project', 'cad_trust_project_id', projectId],
    ];

    for (const [table, key, value] of expectedDeleteRows) {
      expect(hasStagedDelete(stagedRows, table, key, value), `missing staged delete ${table}:${value}`).to.equal(true);
    }

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);

    const childrenToVerifyMissing = [
      ['/v2/location', locationId],
      ['/v2/estimation', estimationId],
      ['/v2/rating', ratingId],
      ['/v2/co-benefit', coBenefitId],
      ['/v2/validation', validationId],
      ['/v2/verification', verificationId],
      ['/v2/project-methodology', projectMethodologyId],
      ['/v2/stakeholder-projects', stakeholderProjectId],
      ['/v2/issuance', issuanceId],
      ['/v2/unit', unitId],
      ['/v2/unit-label', unitLabelId],
      ['/v2/project', projectId],
    ];

    for (const [endpoint, id] of childrenToVerifyMissing) {
      const response = await request.get(`${endpoint}/${id}`);
      expect([400, 404]).to.include(response.status);
    }
  });

  it('should cascade delete unit_label rows when deleting a unit', async function () {
    const programId = await postAndGetId('/v2/program', generateProgram(), 'cadTrustProgramId');
    const projectId = await postAndGetId('/v2/project', generateProject(programId), 'cadTrustProjectId');
    const methodologyId = await postAndGetId('/v2/methodology', generateMethodology(), 'cadTrustMethodologyId');
    const validationId = await postAndGetId('/v2/validation', generateValidation(projectId), 'cadTrustValidationId');
    const verificationId = await postAndGetId('/v2/verification', generateVerification(projectId, validationId), 'cadTrustVerificationId');
    const projectMethodologyId = await postAndGetId('/v2/project-methodology', generateProjectMethodology(projectId, methodologyId), 'cadTrustProjectMethodologyId');
    const issuanceId = await postAndGetId('/v2/issuance', generateIssuance(verificationId, projectMethodologyId), 'cadTrustIssuanceId');
    const unitId = await postAndGetId('/v2/unit', generateUnit(issuanceId), 'cadTrustUnitId');
    const labelId = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const unitLabelId = await postAndGetId('/v2/unit-label', generateUnitLabel(labelId, unitId), 'cadTrustUnitLabelId');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);
    await waitForDataToAppear(request, 'unit-label', unitLabelId);

    const deleteResponse = await request.delete(`/v2/unit/${unitId}`).expect(200);
    expect(deleteResponse.body.success).to.equal(true);
    expect(deleteResponse.body.stagedChildDeletes).to.equal(1);

    const stagingResponse = await request.get('/v2/staging').query({ page: 1, limit: 200 }).expect(200);
    const stagedRows = stagingResponse.body?.data || [];
    expect(hasStagedDelete(stagedRows, 'unit_label', 'cad_trust_unit_label_id', unitLabelId)).to.equal(true);
    expect(hasStagedDelete(stagedRows, 'unit', 'cad_trust_unit_id', unitId)).to.equal(true);

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);

    const unitLabelGet = await request.get(`/v2/unit-label/${unitLabelId}`);
    const unitGet = await request.get(`/v2/unit/${unitId}`);
    expect([400, 404]).to.include(unitLabelGet.status);
    expect([400, 404]).to.include(unitGet.status);
  });
});
