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
    const data = row.diff?.change;
    const parsed = Array.isArray(data) ? data : [data];
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

  it('should cascade delete unit_label, issuance children, and verification children through commit', async function () {
    // Build a shared entity graph once for three cascade-delete scenarios.
    // This avoids three separate commit cycles that would each add ~2 minutes.
    const programId = await postAndGetId('/v2/program', generateProgram(), 'cadTrustProgramId');
    const projectId = await postAndGetId('/v2/project', generateProject(programId), 'cadTrustProjectId');
    const methodologyId = await postAndGetId('/v2/methodology', generateMethodology(), 'cadTrustMethodologyId');

    // Verification 1 — will be deleted as a mid-chain cascade test
    const val1Id = await postAndGetId('/v2/validation', generateValidation(projectId), 'cadTrustValidationId');
    const ver1Id = await postAndGetId('/v2/verification', generateVerification(projectId, val1Id), 'cadTrustVerificationId');
    const pm1Id = await postAndGetId('/v2/project-methodology', generateProjectMethodology(projectId, methodologyId), 'cadTrustProjectMethodologyId');
    const iss1Id = await postAndGetId('/v2/issuance', generateIssuance(ver1Id, pm1Id), 'cadTrustIssuanceId');
    const unit1Id = await postAndGetId('/v2/unit', generateUnit(iss1Id), 'cadTrustUnitId');
    const label1Id = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const ul1Id = await postAndGetId('/v2/unit-label', generateUnitLabel(label1Id, unit1Id), 'cadTrustUnitLabelId');

    // Issuance 2 — will be deleted standalone
    const val2Id = await postAndGetId('/v2/validation', generateValidation(projectId), 'cadTrustValidationId');
    const ver2Id = await postAndGetId('/v2/verification', generateVerification(projectId, val2Id), 'cadTrustVerificationId');
    const iss2Id = await postAndGetId('/v2/issuance', generateIssuance(ver2Id, pm1Id), 'cadTrustIssuanceId');
    const unit2Id = await postAndGetId('/v2/unit', generateUnit(iss2Id), 'cadTrustUnitId');
    const label2Id = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const ul2Id = await postAndGetId('/v2/unit-label', generateUnitLabel(label2Id, unit2Id), 'cadTrustUnitLabelId');

    // Unit 3 — will test bare unit → unit_label cascade
    const val3Id = await postAndGetId('/v2/validation', generateValidation(projectId), 'cadTrustValidationId');
    const ver3Id = await postAndGetId('/v2/verification', generateVerification(projectId, val3Id), 'cadTrustVerificationId');
    const iss3Id = await postAndGetId('/v2/issuance', generateIssuance(ver3Id, pm1Id), 'cadTrustIssuanceId');
    const unit3Id = await postAndGetId('/v2/unit', generateUnit(iss3Id), 'cadTrustUnitId');
    const label3Id = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const ul3Id = await postAndGetId('/v2/unit-label', generateUnitLabel(label3Id, unit3Id), 'cadTrustUnitLabelId');

    // Commit the full graph in one cycle
    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);
    await waitForDataToAppear(request, 'unit-label', ul3Id);

    // --- Scenario A: Delete unit3 → should cascade unit_label ---
    const unitDelResp = await request.delete(`/v2/unit/${unit3Id}`).expect(200);
    expect(unitDelResp.body.success).to.equal(true);
    expect(unitDelResp.body.stagedChildDeletes).to.equal(1);

    // --- Scenario B: Delete issuance2 → should cascade unit2 + unit_label2 ---
    const issDelResp = await request.delete(`/v2/issuance/${iss2Id}`).expect(200);
    expect(issDelResp.body.success).to.equal(true);
    expect(issDelResp.body.stagedChildDeletes).to.equal(2);

    // --- Scenario C: Delete verification1 → should cascade issuance1, unit1, unit_label1 ---
    const verDelResp = await request.delete(`/v2/verification/${ver1Id}`).expect(200);
    expect(verDelResp.body.success).to.equal(true);
    expect(verDelResp.body.stagedChildDeletes).to.equal(3);

    // Verify all expected staging rows
    const stagingResponse = await request.get('/v2/staging').query({ page: 1, limit: 500 }).expect(200);
    const stagedRows = stagingResponse.body?.data || [];

    const expectedStagedDeletes = [
      // Scenario A
      ['unit', 'cad_trust_unit_id', unit3Id],
      ['unit_label', 'cad_trust_unit_label_id', ul3Id],
      // Scenario B
      ['issuance', 'cad_trust_issuance_id', iss2Id],
      ['unit', 'cad_trust_unit_id', unit2Id],
      ['unit_label', 'cad_trust_unit_label_id', ul2Id],
      // Scenario C
      ['verification', 'cad_trust_verification_id', ver1Id],
      ['issuance', 'cad_trust_issuance_id', iss1Id],
      ['unit', 'cad_trust_unit_id', unit1Id],
      ['unit_label', 'cad_trust_unit_label_id', ul1Id],
    ];

    for (const [table, key, value] of expectedStagedDeletes) {
      expect(hasStagedDelete(stagedRows, table, key, value), `missing staged delete ${table}:${value}`).to.equal(true);
    }

    // Commit all deletes in one cycle
    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);

    // Verify everything is gone
    const toVerifyMissing = [
      ['/v2/unit', unit3Id],
      ['/v2/unit-label', ul3Id],
      ['/v2/issuance', iss2Id],
      ['/v2/unit', unit2Id],
      ['/v2/unit-label', ul2Id],
      ['/v2/verification', ver1Id],
      ['/v2/issuance', iss1Id],
      ['/v2/unit', unit1Id],
      ['/v2/unit-label', ul1Id],
    ];

    for (const [endpoint, id] of toVerifyMissing) {
      const resp = await request.get(`${endpoint}/${id}`);
      expect([400, 404]).to.include(resp.status);
    }
  });
});
