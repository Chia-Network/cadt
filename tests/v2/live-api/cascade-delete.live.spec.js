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
    return parsed.some((p) => p?.[key] === value);
  });

  it('should cascade delete project and sub-entity children through commit', async function () {
    // === Graph A: full project cascade (project + 11 children) ===
    const programAId = await postAndGetId('/v2/program', generateProgram(), 'cadTrustProgramId');
    const projectAId = await postAndGetId('/v2/project', generateProject(programAId), 'cadTrustProjectId');
    const methodologyAId = await postAndGetId('/v2/methodology', generateMethodology(), 'cadTrustMethodologyId');
    const validationAId = await postAndGetId('/v2/validation', generateValidation(projectAId), 'cadTrustValidationId');
    const verificationAId = await postAndGetId('/v2/verification', generateVerification(projectAId, validationAId), 'cadTrustVerificationId');
    const projectMethodologyAId = await postAndGetId('/v2/project-methodology', generateProjectMethodology(projectAId, methodologyAId), 'cadTrustProjectMethodologyId');
    const issuanceAId = await postAndGetId('/v2/issuance', generateIssuance(verificationAId, projectMethodologyAId), 'cadTrustIssuanceId');
    const unitAId = await postAndGetId('/v2/unit', generateUnit(issuanceAId), 'cadTrustUnitId');
    const labelAId = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const unitLabelAId = await postAndGetId('/v2/unit-label', generateUnitLabel(labelAId, unitAId), 'cadTrustUnitLabelId');
    const locationAId = await postAndGetId('/v2/location', generateLocation(projectAId), 'cadTrustLocationId');
    const estimationAId = await postAndGetId('/v2/estimation', generateEstimation(projectAId), 'cadTrustEstimationId');
    const ratingAId = await postAndGetId('/v2/rating', generateRating(projectAId), 'cadTrustRatingId');
    const coBenefitAId = await postAndGetId('/v2/co-benefit', generateCoBenefit(projectAId), 'cadTrustCoBenefitId');
    const stakeholderAId = await postAndGetId('/v2/stakeholder', generateStakeholder(), 'cadTrustStakeholderId');
    const stakeholderProjectAId = await postAndGetId('/v2/stakeholder-projects', generateStakeholderProjects(stakeholderAId, projectAId), 'cadTrustStakeholderProjectId');

    // === Graph B: three independent sub-entity cascade scenarios ===
    const programBId = await postAndGetId('/v2/program', generateProgram(), 'cadTrustProgramId');
    const projectBId = await postAndGetId('/v2/project', generateProject(programBId), 'cadTrustProjectId');
    const methodologyBId = await postAndGetId('/v2/methodology', generateMethodology(), 'cadTrustMethodologyId');

    // Verification 1 — will be deleted to cascade issuance1, unit1, unit_label1
    const val1Id = await postAndGetId('/v2/validation', generateValidation(projectBId), 'cadTrustValidationId');
    const ver1Id = await postAndGetId('/v2/verification', generateVerification(projectBId, val1Id), 'cadTrustVerificationId');
    const pm1Id = await postAndGetId('/v2/project-methodology', generateProjectMethodology(projectBId, methodologyBId), 'cadTrustProjectMethodologyId');
    const iss1Id = await postAndGetId('/v2/issuance', generateIssuance(ver1Id, pm1Id), 'cadTrustIssuanceId');
    const unit1Id = await postAndGetId('/v2/unit', generateUnit(iss1Id), 'cadTrustUnitId');
    const label1Id = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const ul1Id = await postAndGetId('/v2/unit-label', generateUnitLabel(label1Id, unit1Id), 'cadTrustUnitLabelId');

    // Issuance 2 — will be deleted to cascade unit2 + unit_label2
    const val2Id = await postAndGetId('/v2/validation', generateValidation(projectBId), 'cadTrustValidationId');
    const ver2Id = await postAndGetId('/v2/verification', generateVerification(projectBId, val2Id), 'cadTrustVerificationId');
    const iss2Id = await postAndGetId('/v2/issuance', generateIssuance(ver2Id, pm1Id), 'cadTrustIssuanceId');
    const unit2Id = await postAndGetId('/v2/unit', generateUnit(iss2Id), 'cadTrustUnitId');
    const label2Id = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const ul2Id = await postAndGetId('/v2/unit-label', generateUnitLabel(label2Id, unit2Id), 'cadTrustUnitLabelId');

    // Unit 3 — will be deleted to cascade unit_label3
    const val3Id = await postAndGetId('/v2/validation', generateValidation(projectBId), 'cadTrustValidationId');
    const ver3Id = await postAndGetId('/v2/verification', generateVerification(projectBId, val3Id), 'cadTrustVerificationId');
    const iss3Id = await postAndGetId('/v2/issuance', generateIssuance(ver3Id, pm1Id), 'cadTrustIssuanceId');
    const unit3Id = await postAndGetId('/v2/unit', generateUnit(iss3Id), 'cadTrustUnitId');
    const label3Id = await postAndGetId('/v2/label', generateLabel(), 'cadTrustLabelId');
    const ul3Id = await postAndGetId('/v2/unit-label', generateUnitLabel(label3Id, unit3Id), 'cadTrustUnitLabelId');

    // --- Commit cycle 1: commit both graphs in one pass ---
    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);

    await waitForDataToAppear(request, 'project', projectAId);
    await waitForDataToAppear(request, 'unit-label', unitLabelAId);
    await waitForDataToAppear(request, 'unit-label', ul3Id);

    // --- Graph A deletes: delete projectA → cascades 11 children ---
    const deleteResponse = await request.delete(`/v2/project/${projectAId}`).expect(200);
    expect(deleteResponse.body.success).to.equal(true);
    expect(deleteResponse.body.stagedChildDeletes).to.equal(11);

    const stagingResponseA = await request.get('/v2/staging').query({ page: 1, limit: 500 }).expect(200);
    const stagedRowsA = stagingResponseA.body?.data || [];

    const expectedDeleteRowsA = [
      ['location', 'cad_trust_location_id', locationAId],
      ['estimation', 'cad_trust_estimation_id', estimationAId],
      ['rating', 'cad_trust_rating_id', ratingAId],
      ['co_benefit', 'cad_trust_co_benefit_id', coBenefitAId],
      ['validation', 'cad_trust_validation_id', validationAId],
      ['verification', 'cad_trust_verification_id', verificationAId],
      ['project_methodology', 'cad_trust_project_methodology_id', projectMethodologyAId],
      ['stakeholder_projects', 'cad_trust_stakeholder_project_id', stakeholderProjectAId],
      ['issuance', 'cad_trust_issuance_id', issuanceAId],
      ['unit', 'cad_trust_unit_id', unitAId],
      ['unit_label', 'cad_trust_unit_label_id', unitLabelAId],
      ['project', 'cad_trust_project_id', projectAId],
    ];

    for (const [table, key, value] of expectedDeleteRowsA) {
      expect(hasStagedDelete(stagedRowsA, table, key, value), `missing staged delete ${table}:${value}`).to.equal(true);
    }

    // --- Graph B deletes: unit3, issuance2, verification1 ---
    const unitDelResp = await request.delete(`/v2/unit/${unit3Id}`).expect(200);
    expect(unitDelResp.body.success).to.equal(true);
    expect(unitDelResp.body.stagedChildDeletes).to.equal(1);

    const issDelResp = await request.delete(`/v2/issuance/${iss2Id}`).expect(200);
    expect(issDelResp.body.success).to.equal(true);
    expect(issDelResp.body.stagedChildDeletes).to.equal(2);

    const verDelResp = await request.delete(`/v2/verification/${ver1Id}`).expect(200);
    expect(verDelResp.body.success).to.equal(true);
    expect(verDelResp.body.stagedChildDeletes).to.equal(3);

    const stagingResponseB = await request.get('/v2/staging').query({ page: 1, limit: 500 }).expect(200);
    const stagedRowsB = stagingResponseB.body?.data || [];

    const expectedStagedDeletesB = [
      // unit3 cascade
      ['unit', 'cad_trust_unit_id', unit3Id],
      ['unit_label', 'cad_trust_unit_label_id', ul3Id],
      // issuance2 cascade
      ['issuance', 'cad_trust_issuance_id', iss2Id],
      ['unit', 'cad_trust_unit_id', unit2Id],
      ['unit_label', 'cad_trust_unit_label_id', ul2Id],
      // verification1 cascade
      ['verification', 'cad_trust_verification_id', ver1Id],
      ['issuance', 'cad_trust_issuance_id', iss1Id],
      ['unit', 'cad_trust_unit_id', unit1Id],
      ['unit_label', 'cad_trust_unit_label_id', ul1Id],
    ];

    for (const [table, key, value] of expectedStagedDeletesB) {
      expect(hasStagedDelete(stagedRowsB, table, key, value), `missing staged delete ${table}:${value}`).to.equal(true);
    }

    // --- Commit cycle 2: commit all deletes (both graphs) in one pass ---
    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request);
    await waitForStagingEmpty(request);

    // Verify Graph A entities are gone
    const childrenToVerifyMissingA = [
      ['/v2/location', locationAId],
      ['/v2/estimation', estimationAId],
      ['/v2/rating', ratingAId],
      ['/v2/co-benefit', coBenefitAId],
      ['/v2/validation', validationAId],
      ['/v2/verification', verificationAId],
      ['/v2/project-methodology', projectMethodologyAId],
      ['/v2/stakeholder-projects', stakeholderProjectAId],
      ['/v2/issuance', issuanceAId],
      ['/v2/unit', unitAId],
      ['/v2/unit-label', unitLabelAId],
      ['/v2/project', projectAId],
    ];

    for (const [endpoint, id] of childrenToVerifyMissingA) {
      const response = await request.get(`${endpoint}/${id}`);
      expect([400, 404]).to.include(response.status);
    }

    // Verify Graph B entities are gone
    const toVerifyMissingB = [
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

    for (const [endpoint, id] of toVerifyMissingB) {
      const resp = await request.get(`${endpoint}/${id}`);
      expect([400, 404]).to.include(resp.status);
    }

    // Verify non-deleted Graph B siblings are still present (guards against
    // overly-aggressive cascades that silently delete sibling entities)
    const survivingGraphB = [
      ['/v2/project', projectBId],
      ['/v2/project-methodology', pm1Id],
      ['/v2/verification', ver2Id],
      ['/v2/verification', ver3Id],
      ['/v2/issuance', iss3Id],
    ];

    for (const [endpoint, id] of survivingGraphB) {
      const resp = await request.get(`${endpoint}/${id}`);
      expect(resp.status, `expected ${endpoint}/${id} to still exist after cascade`).to.equal(200);
    }
  });
});
