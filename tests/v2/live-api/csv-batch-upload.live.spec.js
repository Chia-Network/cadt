import { expect } from 'chai';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
} from './helpers/live-api-helpers.js';
import { getSharedRequest, getSharedHomeOrgId } from './helpers/shared-setup.js';
import { makePutRequest } from './helpers/api-request-helpers.js';
import { getFirstCreatedId } from './helpers/shared-state.js';

// Standalone live test for CSV batch upload.
//
// This suite intentionally is NOT part of the shared data-short/data-extended
// orchestration because CSV batch INSERT rows do not expose per-row staging IDs
// in the API response, which makes it unsafe to commit only this suite's rows
// on a shared live environment. Run it against a disposable test instance.

const runId = String(Date.now());
const projectIdsUnderTest = [
  `TEST-BATCH-LIVE-PRJ-${runId}-001`,
  `TEST-BATCH-LIVE-PRJ-${runId}-002`,
];
const unitSerialsUnderTest = [
  `TEST-BATCH-LIVE-UNIT-${runId}-001`,
  `TEST-BATCH-LIVE-UNIT-${runId}-002`,
];

async function listStagingRows(request) {
  const response = await request
    .get('/v2/staging')
    .query({ page: 1, limit: 1000 })
    .expect(200);
  return response.body?.data || response.body || [];
}

async function listProjects(request, homeOrgId) {
  const response = await request
    .get('/v2/project')
    .query({ page: 1, limit: 1000, orgUid: homeOrgId })
    .expect(200);

  return response.body?.data || response.body || [];
}

async function listUnits(request, homeOrgId) {
  const response = await request
    .get('/v2/unit')
    .query({ page: 1, limit: 1000, orgUid: homeOrgId })
    .expect(200);

  return response.body?.data || response.body || [];
}

async function resolvePrereqId(request, type, pkField, homeOrgId) {
  const sharedId = getFirstCreatedId(type);
  if (sharedId) {
    const response = await request.get(`/v2/${type}/${sharedId}`);
    if (response.status === 200) {
      return sharedId;
    }
  }

  const response = await request
    .get(`/v2/${type}`)
    .query({ page: 1, limit: 1000 });
  if (response.status !== 200) {
    return null;
  }

  const records = response.body?.data || response.body || [];
  const homeOrgRecord = records.find((record) => {
    const recordOrgUid = record.orgUid || record.org_uid;
    return recordOrgUid && recordOrgUid === homeOrgId;
  });
  const selected = homeOrgRecord || records[0];
  return selected ? selected[pkField] : null;
}

function buildProjectPutData(record, overrides = {}) {
  return {
    projectRegistryName: record.projectRegistryName,
    projectId: record.projectId,
    projectName: record.projectName,
    projectCreditingProgram: record.projectCreditingProgram ?? null,
    projectLink: record.projectLink ?? null,
    projectDescription: record.projectDescription ?? null,
    projectSector: record.projectSector ?? null,
    projectType: record.projectType ?? null,
    projectSubtype: record.projectSubtype ?? null,
    projectStatus: record.projectStatus ?? null,
    projectStatusDate: record.projectStatusDate ?? null,
    projectUnitMetric: record.projectUnitMetric ?? null,
    cadTrustReferenceProjectId: record.cadTrustReferenceProjectId ?? null,
    cadTrustProgramId: record.cadTrustProgramId ?? null,
    ...overrides,
  };
}

function buildUnitPutData(record, overrides = {}) {
  return {
    unitSerialId: record.unitSerialId,
    unitStartBlock: record.unitStartBlock,
    unitEndBlock: record.unitEndBlock,
    unitVintageYear: record.unitVintageYear,
    cadTrustIssuanceId: record.cadTrustIssuanceId,
    unitCount: record.unitCount ?? null,
    unitType: record.unitType ?? null,
    unitStatus: record.unitStatus ?? null,
    unitStatusReason: record.unitStatusReason ?? null,
    unitStatusDate: record.unitStatusDate ?? null,
    unitRetirementDetail: record.unitRetirementDetail ?? null,
    unitRetirementBeneficiary: record.unitRetirementBeneficiary ?? null,
    unitRetirementBeneficiaryId: record.unitRetirementBeneficiaryId ?? null,
    unitLink: record.unitLink ?? null,
    unitMetric: record.unitMetric ?? null,
    unitCurrentOwner: record.unitCurrentOwner ?? null,
    unitItmosReferenceId: record.unitItmosReferenceId ?? null,
    marketplace: record.marketplace ?? null,
    marketplaceLink: record.marketplaceLink ?? null,
    marketplaceIdentifier: record.marketplaceIdentifier ?? null,
    ...overrides,
  };
}

function stageRowMatches(row, predicate) {
  try {
    const parsed = JSON.parse(row.data);
    const records = Array.isArray(parsed) ? parsed : [parsed];
    return records.some(predicate);
  } catch {
    return false;
  }
}

async function getBatchStagingIds(request, table, predicate) {
  const rows = await listStagingRows(request);
  return rows
    .filter((row) => row.table === table)
    .filter((row) => stageRowMatches(row, predicate))
    .map((row) => row.uuid);
}

describe('CSV Batch Upload Live API Tests', function () {
  this.timeout(1800000);

  let request;
  let homeOrgId;
  let programId;
  let issuanceId;
  let createdProjectIds = [];
  let createdUnitIds = [];

  before(async function () {
    request = getSharedRequest();
    homeOrgId = getSharedHomeOrgId();
    programId = await resolvePrereqId(request, 'program', 'cadTrustProgramId', homeOrgId);
    issuanceId = await resolvePrereqId(request, 'issuance', 'cadTrustIssuanceId', homeOrgId);

    if (!programId) {
      throw new Error('CSV batch live tests require an existing program record');
    }
    if (!issuanceId) {
      throw new Error('CSV batch live tests require an existing issuance record');
    }
  });

  after(async function () {
    if (!request) {
      return;
    }

    try {
      if (createdUnitIds.length === 0 || createdProjectIds.length === 0) {
        const [projects, units] = await Promise.all([
          listProjects(request, homeOrgId),
          listUnits(request, homeOrgId),
        ]);
        if (createdProjectIds.length === 0) {
          createdProjectIds = projects
            .filter((project) => projectIdsUnderTest.includes(project.projectId))
            .map((project) => project.cadTrustProjectId);
        }
        if (createdUnitIds.length === 0) {
          createdUnitIds = units
            .filter((unit) => unitSerialsUnderTest.includes(unit.unitSerialId))
            .map((unit) => unit.cadTrustUnitId);
        }
      }

      for (const unitId of createdUnitIds) {
        await request.delete(`/v2/unit/${unitId}`);
      }
      for (const projectId of createdProjectIds) {
        await request.delete(`/v2/project/${projectId}`);
      }

      if (createdUnitIds.length > 0 || createdProjectIds.length > 0) {
        const deleteStageIds = [
          ...(await getBatchStagingIds(request, 'unit', (record) =>
            createdUnitIds.includes(record.cad_trust_unit_id || record.cadTrustUnitId))),
          ...(await getBatchStagingIds(request, 'project', (record) =>
            createdProjectIds.includes(record.cad_trust_project_id || record.cadTrustProjectId))),
        ];
        if (deleteStageIds.length > 0) {
          await commitStagedRecords(request, deleteStageIds, true);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        }
      }
    } catch (error) {
      console.warn(`CSV batch live test cleanup warning: ${error.message}`);
    }
  });

  describe('Step 17: CSV batch insert (projects + units)', function () {
    it('should stage project and unit CSV batch inserts', async function () {
      const projectCsv = `projectRegistryName,projectId,projectName,cadTrustProgramId
Test Registry,${projectIdsUnderTest[0]},CSV Batch Live Project 1,${programId}
Test Registry,${projectIdsUnderTest[1]},CSV Batch Live Project 2,${programId}`;
      const unitCsv = `unitSerialId,unitStartBlock,unitEndBlock,unitCount,unitType,unitVintageYear,unitStatus,cadTrustIssuanceId
${unitSerialsUnderTest[0]},100,200,50,Avoidance - nature,2024,Issued,${issuanceId}
${unitSerialsUnderTest[1]},300,400,60,Reduction - technical,2024,Held,${issuanceId}`;

      const [projectResponse, unitResponse] = await Promise.all([
        request.post('/v2/project/batch').attach('csv', Buffer.from(projectCsv, 'utf8'), 'projects.csv'),
        request.post('/v2/unit/batch').attach('csv', Buffer.from(unitCsv, 'utf8'), 'units.csv'),
      ]);

      expect(projectResponse.status).to.equal(200);
      expect(projectResponse.body.success).to.be.true;
      expect(projectResponse.body.stagedCount).to.equal(2);

      expect(unitResponse.status).to.equal(200);
      expect(unitResponse.body.success).to.be.true;
      expect(unitResponse.body.stagedCount).to.equal(2);
    });
  });

  describe('Step 17a: Commit inserted CSV rows and verify they appear', function () {
    it('should commit staged CSV inserts and find the created records', async function () {
      const stageIds = [
        ...(await getBatchStagingIds(request, 'project', (record) =>
          projectIdsUnderTest.includes(record.project_id || record.projectId))),
        ...(await getBatchStagingIds(request, 'unit', (record) =>
          unitSerialsUnderTest.includes(record.unit_serial_id || record.unitSerialId))),
      ];
      await commitStagedRecords(request, stageIds, true);
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);

      const [projects, units] = await Promise.all([
        listProjects(request, homeOrgId),
        listUnits(request, homeOrgId),
      ]);

      createdProjectIds = projectIdsUnderTest.map((projectId) => {
        const project = projects.find((candidate) => candidate.projectId === projectId);
        expect(project, `Project ${projectId} not found after CSV batch commit`).to.exist;
        return project.cadTrustProjectId;
      });

      createdUnitIds = unitSerialsUnderTest.map((serialId) => {
        const unit = units.find((candidate) => candidate.unitSerialId === serialId);
        expect(unit, `Unit ${serialId} not found after CSV batch commit`).to.exist;
        return unit.cadTrustUnitId;
      });
    });
  });

  describe('Step 17b: Stage REST updates, then merge CSV updates into them', function () {
    it('should preserve already-staged REST updates when CSV batch updates the same records', async function () {
      const [projectResponse, unitResponse] = await Promise.all([
        request.get(`/v2/project/${createdProjectIds[0]}`).expect(200),
        request.get(`/v2/unit/${createdUnitIds[0]}`).expect(200),
      ]);
      const project = projectResponse.body.data || projectResponse.body;
      const unit = unitResponse.body.data || unitResponse.body;

      const projectUpdate = buildProjectPutData(project, {
        projectDescription: 'REST staged project description from live batch test',
      });
      const unitUpdate = buildUnitPutData(unit, {
        unitLink: 'https://example.com/live-batch-staged-unit-link',
      });

      const [projectPutResponse, unitPutResponse] = await Promise.all([
        makePutRequest(request, '/v2/project', createdProjectIds[0], projectUpdate),
        makePutRequest(request, '/v2/unit', createdUnitIds[0], unitUpdate),
      ]);
      expect(projectPutResponse.success).to.be.true;
      expect(unitPutResponse.success).to.be.true;

      const projectCsv = `cadTrustProjectId,projectName
${createdProjectIds[0]},CSV Batch Live Updated Project Name`;
      const unitCsv = `cadTrustUnitId,unitSerialId,unitEndBlock
${createdUnitIds[0]},,250`;

      const [projectBatchResponse, unitBatchResponse] = await Promise.all([
        request.post('/v2/project/batch').attach('csv', Buffer.from(projectCsv, 'utf8'), 'project-update.csv'),
        request.post('/v2/unit/batch').attach('csv', Buffer.from(unitCsv, 'utf8'), 'unit-update.csv'),
      ]);

      expect(projectBatchResponse.status).to.equal(200);
      expect(projectBatchResponse.body.success).to.be.true;
      expect(projectBatchResponse.body.stagedCount).to.equal(1);

      expect(unitBatchResponse.status).to.equal(200);
      expect(unitBatchResponse.body.success).to.be.true;
      expect(unitBatchResponse.body.stagedCount).to.equal(1);
    });
  });

  describe('Step 17c: Commit merged updates and verify final state', function () {
    it('should commit merged CSV/REST updates and persist the combined result', async function () {
      const stageIds = [
        ...(await getBatchStagingIds(request, 'project', (record) =>
          (record.cad_trust_project_id || record.cadTrustProjectId) === createdProjectIds[0])),
        ...(await getBatchStagingIds(request, 'unit', (record) =>
          (record.cad_trust_unit_id || record.cadTrustUnitId) === createdUnitIds[0])),
      ];
      await commitStagedRecords(request, stageIds, true);
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);

      const [projectResponse, unitResponse] = await Promise.all([
        request.get(`/v2/project/${createdProjectIds[0]}`).expect(200),
        request.get(`/v2/unit/${createdUnitIds[0]}`).expect(200),
      ]);
      const project = projectResponse.body.data || projectResponse.body;
      const unit = unitResponse.body.data || unitResponse.body;

      expect(project.projectName).to.equal('CSV Batch Live Updated Project Name');
      expect(project.projectDescription).to.equal('REST staged project description from live batch test');

      expect(String(unit.unitEndBlock)).to.equal('250');
      expect(unit.unitLink).to.equal('https://example.com/live-batch-staged-unit-link');
      expect(unit.unitSerialId).to.equal('100-250');
    });
  });

  describe('Step 17d: Clean up live CSV batch records', function () {
    it('should delete the batch-created units and projects', async function () {
      for (const unitId of createdUnitIds) {
        const response = await request.delete(`/v2/unit/${unitId}`);
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
      }
      for (const projectId of createdProjectIds) {
        const response = await request.delete(`/v2/project/${projectId}`);
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
      }

      const stageIds = [
        ...(await getBatchStagingIds(request, 'unit', (record) =>
          createdUnitIds.includes(record.cad_trust_unit_id || record.cadTrustUnitId))),
        ...(await getBatchStagingIds(request, 'project', (record) =>
          createdProjectIds.includes(record.cad_trust_project_id || record.cadTrustProjectId))),
      ];
      await commitStagedRecords(request, stageIds, true);
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);
    });
  });

  describe('Step 17e: Verify cleanup', function () {
    it('should no longer find the deleted CSV batch records', async function () {
      for (const unitId of createdUnitIds) {
        const response = await request.get(`/v2/unit/${unitId}`);
        expect(response.status).to.equal(404);
      }
      for (const projectId of createdProjectIds) {
        const response = await request.get(`/v2/project/${projectId}`);
        expect(response.status).to.equal(404);
      }
    });
  });
});
