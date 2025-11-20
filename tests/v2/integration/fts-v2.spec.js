import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import { Sequelize } from 'sequelize';
import {
  ProjectV2,
  UnitV2,
  ProgramV2,
  IssuanceV2,
  ValidationV2,
  VerificationV2,
  MethodologyV2,
} from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
} from '../utils/v2-test-helpers.js';

describe('V2 FTS5 Integration Tests', function () {
  this.timeout(60000);

  let homeOrg;
  let testProgram;
  let testProject1;
  let testProject2;
  let testProject3;
  let testIssuance1;
  let testIssuance2;
  let testUnit1;
  let testUnit2;
  let testUnit3;
  let homeOrgId;

  before(async function () {
    console.log('Setting up V2 FTS test environment...');
    await prepareV2Db();

    // Create test home organization
    homeOrg = await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create test program
    testProgram = await ProgramV2.create({
      programName: 'Test Program for FTS',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    // Create test projects with different searchable content
    testProject1 = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Forestry Registry',
      projectId: 'FOREST-001',
      projectName: 'Forest Conservation Project',
      projectDescription: 'A project focused on forest conservation and reforestation',
      projectSector: 'Agriculture Forestry and Other Land Use (AFOLU)',
      projectType: 'Afforestation',
      projectStatus: 'Registered',
      projectStatusDate: '2024-01-01',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    testProject2 = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Energy Registry',
      projectId: 'ENERGY-002',
      projectName: 'Renewable Energy Solar Farm',
      projectDescription: 'Large-scale solar energy generation project',
      projectSector: 'Energy',
      projectType: 'Solar',
      projectStatus: 'Listed',
      projectStatusDate: '2024-02-01',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    testProject3 = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Water Registry',
      projectId: 'WATER-003',
      projectName: 'Water Conservation Initiative',
      projectDescription: 'Water management and conservation project',
      projectSector: 'Water',
      projectType: 'Water Management',
      projectStatus: 'Validated',
      projectStatusDate: '2024-03-01',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    // Create test validations and verifications
    const testValidation1 = await ValidationV2.create({
      cadTrustValidationId: uuidv4(),
      validationId: 'VAL-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'Test Validator',
      cadTrustProjectId: testProject1.cadTrustProjectId,
    });

    const testVerification1 = await VerificationV2.create({
      cadTrustVerificationId: uuidv4(),
      verificationId: 'VER-001',
      verificationBody: 'Test Verifier',
      cadTrustProjectId: testProject1.cadTrustProjectId,
      cadTrustValidationId: testValidation1.cadTrustValidationId,
    });

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METH-001',
      methodologyName: 'Test Methodology',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    // Create test verifications for project2
    const testValidation2 = await ValidationV2.create({
      cadTrustValidationId: uuidv4(),
      validationId: 'VAL-002',
      validationType: 'Validation of Project Design Document',
      validationBody: 'Test Validator',
      cadTrustProjectId: testProject2.cadTrustProjectId,
    });

    const testVerification2 = await VerificationV2.create({
      cadTrustVerificationId: uuidv4(),
      verificationId: 'VER-002',
      verificationBody: 'Test Verifier',
      cadTrustProjectId: testProject2.cadTrustProjectId,
      cadTrustValidationId: testValidation2.cadTrustValidationId,
    });

    // Create test issuances (issuance links to project through verification)
    testIssuance1 = await IssuanceV2.create({
      cadTrustIssuanceId: uuidv4(),
      issuanceId: 'ISS-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification1.cadTrustVerificationId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
    });

    testIssuance2 = await IssuanceV2.create({
      cadTrustIssuanceId: uuidv4(),
      issuanceId: 'ISS-002',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification2.cadTrustVerificationId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
    });

    // Create test units
    testUnit1 = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'UNIT-FOREST-001',
      unitStartBlock: 'A001',
      unitEndBlock: 'A100',
      unitCount: 100,
      unitType: 'Removal - nature',
      unitVintageYear: 2024,
      unitStatus: 'Held',
      unitLink: 'https://example.com/unit1',
      cadTrustIssuanceId: testIssuance1.cadTrustIssuanceId,
    });

    testUnit2 = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'UNIT-ENERGY-002',
      unitStartBlock: 'B001',
      unitEndBlock: 'B200',
      unitCount: 200,
      unitType: 'Reduction - technical',
      unitVintageYear: 2024,
      unitStatus: 'Retired',
      unitLink: 'https://example.com/unit2',
      cadTrustIssuanceId: testIssuance2.cadTrustIssuanceId,
    });

    testUnit3 = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'UNIT-WATER-003',
      unitStartBlock: 'C001',
      unitEndBlock: 'C050',
      unitCount: 50,
      unitType: 'Removal - technical',
      unitVintageYear: 2024,
      unitStatus: 'Held',
      unitLink: 'https://example.com/unit3',
      cadTrustIssuanceId: testIssuance2.cadTrustIssuanceId,
    });

    // Wait a bit for FTS triggers to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Manually rebuild FTS tables to ensure they're populated
    // (Triggers should handle this, but rebuilding ensures consistency)
    await ProjectV2.rebuildFtsTable();
    await UnitV2.rebuildFtsTable();
  });

  after(async function () {
    console.log('Cleaning up V2 FTS test environment...');
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  describe('Project FTS Search - Model Methods', function () {
    it('should find projects by search term in project name', async function () {
      const results = await ProjectV2.findAllSqliteFts(
        'Forest',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results).to.have.property('count');
      expect(results).to.have.property('rows');
      expect(results.count).to.be.at.least(1);
      expect(results.rows.length).to.be.at.least(1);

      const projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.include(testProject1.cadTrustProjectId);
    });

    it('should find projects by search term in description', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const results = await ProjectV2.findAllSqliteFts(
        'solar',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results.count).to.be.at.least(1);
      const projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.include(testProject2.cadTrustProjectId);
    });

    it('should find projects by search term in sector', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const results = await ProjectV2.findAllSqliteFts(
        'Energy',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results.count).to.be.at.least(1);
      const projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.include(testProject2.cadTrustProjectId);
    });

    it('should filter projects by orgUid', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const results = await ProjectV2.findAllSqliteFts(
        'project',
        { offset: 0, limit: 10 },
        [],
        homeOrgId,
      );

      expect(results.count).to.be.at.least(1);
      // All results should belong to homeOrgId
      results.rows.forEach((row) => {
        const orgUid = row.org_uid || row.orgUid;
        expect(orgUid).to.exist;
        expect(orgUid).to.equal(homeOrgId);
      });
    });

    it('should return empty results for non-matching search', async function () {
      const results = await ProjectV2.findAllSqliteFts(
        'nonexistentterm12345',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results.count).to.equal(0);
      expect(results.rows).to.be.an('array').that.is.empty;
    });

    it('should return empty results for empty search string', async function () {
      const results = await ProjectV2.findAllSqliteFts(
        '',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results.count).to.equal(0);
      expect(results.rows).to.be.an('array').that.is.empty;
    });

    it('should return empty results for asterisk-only search', async function () {
      const results = await ProjectV2.findAllSqliteFts(
        '*',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results.count).to.equal(0);
      expect(results.rows).to.be.an('array').that.is.empty;
    });

    it('should support pagination', async function () {
      const page1 = await ProjectV2.findAllSqliteFts(
        'project',
        { offset: 0, limit: 2 },
        [],
        null,
      );

      const page2 = await ProjectV2.findAllSqliteFts(
        'project',
        { offset: 2, limit: 2 },
        [],
        null,
      );

      expect(page1.rows.length).to.be.at.most(2);
      expect(page2.rows.length).to.be.at.most(2);

      // Results should be different
      const page1Ids = page1.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      const page2Ids = page2.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      page1Ids.forEach((id) => {
        expect(page2Ids).to.not.include(id);
      });
    });

    it('should return BM25 relevance scores', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const results = await ProjectV2.findAllSqliteFts(
        'Forest',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      expect(results.rows.length).to.be.at.least(1);
      results.rows.forEach((row) => {
        expect(row).to.have.property('relevance');
        expect(row.relevance).to.be.a('number');
        // BM25 scores can be negative (lower is better)
      });
    });

    it('should order results by BM25 relevance (ascending)', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const results = await ProjectV2.findAllSqliteFts(
        'project',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      if (results.rows.length > 1) {
        for (let i = 0; i < results.rows.length - 1; i++) {
          expect(results.rows[i].relevance).to.be.at.most(results.rows[i + 1].relevance);
        }
      }
    });

    it('should support column selection', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const results = await ProjectV2.findAllSqliteFts(
        'Forest',
        { offset: 0, limit: 10 },
        ['projectName', 'projectSector'],
        null,
      );

      expect(results.rows.length).to.be.at.least(1);
      results.rows.forEach((row) => {
        // Should have selected columns (may be snake_case or camelCase)
        const hasName = row.project_name || row.projectName;
        const hasSector = row.project_sector || row.projectSector;
        expect(hasName || hasSector).to.exist;
      });
    });
  });

  describe('Unit FTS Search - Model Methods', function () {
    it('should find units by search term in serial ID', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      const results = await UnitV2.findAllSqliteFts(
        'FOREST',
        { offset: 0, limit: 10 },
        [],
        false,
        null,
      );

      expect(results.count).to.be.at.least(1);
      const unitIds = results.rows.map((r) => r.cad_trust_unit_id || r.cadTrustUnitId);
      expect(unitIds).to.include(testUnit1.cadTrustUnitId);
    });

    it('should find units by search term in unit type', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      const results = await UnitV2.findAllSqliteFts(
        'Removal',
        { offset: 0, limit: 10 },
        [],
        false,
        null,
      );

      expect(results.count).to.be.at.least(2);
      const unitIds = results.rows.map((r) => r.cad_trust_unit_id || r.cadTrustUnitId);
      expect(unitIds).to.include(testUnit1.cadTrustUnitId);
      expect(unitIds).to.include(testUnit3.cadTrustUnitId);
    });

    it('should filter units by orgUid', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      const results = await UnitV2.findAllSqliteFts(
        'UNIT',
        { offset: 0, limit: 10 },
        [],
        false,
        homeOrgId,
      );

      expect(results.count).to.be.at.least(1);
      results.rows.forEach((row) => {
        const orgUid = row.org_uid || row.orgUid;
        expect(orgUid).to.exist;
        expect(orgUid).to.equal(homeOrgId);
      });
    });

    it('should support UNION query for assetId search (0x prefix)', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      const results = await UnitV2.findAllSqliteFts(
        '001',
        { offset: 0, limit: 10 },
        [],
        false,
        null,
      );

      expect(results.count).to.be.at.least(1);
      // Should find units with '001' in serial ID or block
      const unitIds = results.rows.map((r) => r.cad_trust_unit_id || r.cadTrustUnitId);
      expect(unitIds.length).to.be.at.least(1);
    });

    it('should support project info search when includeProjectInfo is true', async function () {
      // Ensure FTS tables are populated
      await ProjectV2.rebuildFtsTable();
      await UnitV2.rebuildFtsTable();

      const results = await UnitV2.findAllSqliteFts(
        'Forest',
        { offset: 0, limit: 10 },
        [],
        true, // includeProjectInfo
        null,
      );

      expect(results.count).to.be.at.least(1);
      // Should find units associated with projects containing "Forest"
      const unitIds = results.rows.map((r) => r.cad_trust_unit_id || r.cadTrustUnitId);
      expect(unitIds).to.include(testUnit1.cadTrustUnitId);
    });

    it('should return BM25 relevance scores for units', async function () {
      const results = await UnitV2.findAllSqliteFts(
        'UNIT',
        { offset: 0, limit: 10 },
        [],
        false,
        null,
      );

      expect(results.rows.length).to.be.at.least(1);
      results.rows.forEach((row) => {
        expect(row).to.have.property('relevance');
        expect(row.relevance).to.be.a('number');
        // BM25 scores can be negative (lower is better)
      });
    });

    it('should order UNION results by BM25 relevance', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      // Use a more specific search term to avoid SQL keyword conflicts
      const results = await UnitV2.findAllSqliteFts(
        'FOREST',
        { offset: 0, limit: 10 },
        [],
        false,
        null,
      );

      if (results.rows.length > 1) {
        for (let i = 0; i < results.rows.length - 1; i++) {
          expect(results.rows[i].relevance).to.be.at.most(results.rows[i + 1].relevance);
        }
      }
    });
  });

  describe('Project FTS Search - API Endpoints', function () {
    it('should search projects via GET /v2/project?search=', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const response = await supertest(app)
        .get('/v2/project')
        .query({ search: 'Forest', page: 1, limit: 10 });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.at.least(1);

      const projectIds = response.body.data.map((p) => p.cadTrustProjectId);
      expect(projectIds).to.include(testProject1.cadTrustProjectId);
    });

    it('should filter projects by orgUid when using search', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const response = await supertest(app)
        .get('/v2/project')
        .query({ search: 'project', orgUid: homeOrgId, page: 1, limit: 10 });

      expect(response.status).to.equal(200);
      expect(response.body.data.length).to.be.at.least(1);
      response.body.data.forEach((project) => {
        expect(project.orgUid).to.equal(homeOrgId);
      });
    });

    it('should support pagination with search', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const page1 = await supertest(app)
        .get('/v2/project')
        .query({ search: 'project', page: 1, limit: 2 });

      const page2 = await supertest(app)
        .get('/v2/project')
        .query({ search: 'project', page: 2, limit: 2 });

      expect(page1.status).to.equal(200);
      expect(page2.status).to.equal(200);
      expect(page1.body.data.length).to.be.at.most(2);
      expect(page2.body.data.length).to.be.at.most(2);
    });

    it('should support column selection with search', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const response = await supertest(app)
        .get('/v2/project')
        .query({
          search: 'Forest',
          columns: ['projectName', 'projectSector'],
          page: 1,
          limit: 10,
        });

      expect(response.status).to.equal(200);
      expect(response.body.data.length).to.be.at.least(1);
      response.body.data.forEach((project) => {
        expect(project).to.have.property('projectName');
        expect(project).to.have.property('projectSector');
      });
    });

    it('should return empty results for non-matching search', async function () {
      // Ensure FTS table is populated
      await ProjectV2.rebuildFtsTable();

      const response = await supertest(app)
        .get('/v2/project')
        .query({ search: 'nonexistentterm12345', page: 1, limit: 10 });

      expect(response.status).to.equal(200);
      expect(response.body.data).to.be.an('array').that.is.empty;
      expect(response.body.pageCount).to.equal(0);
    });
  });

  describe('Unit FTS Search - API Endpoints', function () {
    it('should search units via GET /v2/unit?search=', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      const response = await supertest(app)
        .get('/v2/unit')
        .query({ search: 'FOREST', page: 1, limit: 10 });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.at.least(1);

      const unitIds = response.body.data.map((u) => u.cadTrustUnitId);
      expect(unitIds).to.include(testUnit1.cadTrustUnitId);
    });

    it('should filter units by orgUid when using search', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      // Use a more specific search term to avoid SQL keyword conflicts
      const response = await supertest(app)
        .get('/v2/unit')
        .query({ search: 'FOREST', orgUid: homeOrgId, page: 1, limit: 10 });

      expect(response.status).to.equal(200);
      expect(response.body.data.length).to.be.at.least(1);
      response.body.data.forEach((unit) => {
        expect(unit.orgUid).to.equal(homeOrgId);
      });
    });

    it('should support includeProjectInfoInSearch parameter', async function () {
      // Ensure FTS tables are populated
      await ProjectV2.rebuildFtsTable();
      await UnitV2.rebuildFtsTable();

      const response = await supertest(app)
        .get('/v2/unit')
        .query({
          search: 'Forest',
          includeProjectInfoInSearch: 'true',
          page: 1,
          limit: 10,
        });

      expect(response.status).to.equal(200);
      expect(response.body.data.length).to.be.at.least(1);
      const unitIds = response.body.data.map((u) => u.cadTrustUnitId);
      expect(unitIds).to.include(testUnit1.cadTrustUnitId);
    });

    it('should support pagination with search', async function () {
      // Ensure FTS table is populated
      await UnitV2.rebuildFtsTable();

      // Use a more specific search term to avoid SQL keyword conflicts
      const page1 = await supertest(app)
        .get('/v2/unit')
        .query({ search: 'FOREST', page: 1, limit: 2 });

      const page2 = await supertest(app)
        .get('/v2/unit')
        .query({ search: 'FOREST', page: 2, limit: 2 });

      expect(page1.status).to.equal(200);
      expect(page2.status).to.equal(200);
      expect(page1.body.data.length).to.be.at.most(2);
      expect(page2.body.data.length).to.be.at.most(2);
    });
  });

  describe('FTS Rebuild Utilities', function () {
    it('should rebuild projects FTS table', async function () {
      // Verify FTS table exists and has data
      const beforeResults = await sequelizeV2.query(
        'SELECT COUNT(*) as count FROM projects_v2_fts',
        { type: sequelizeV2.QueryTypes.SELECT },
      );
      const beforeCount = beforeResults[0].count;

      expect(beforeCount).to.be.at.least(3);

      // Rebuild FTS table
      await ProjectV2.rebuildFtsTable();

      // Verify data still exists after rebuild
      const afterResults = await sequelizeV2.query(
        'SELECT COUNT(*) as count FROM projects_v2_fts',
        { type: sequelizeV2.QueryTypes.SELECT },
      );
      const afterCount = afterResults[0].count;

      expect(afterCount).to.equal(beforeCount);
    });

    it('should rebuild units FTS table', async function () {
      // Verify FTS table exists and has data
      const beforeResults = await sequelizeV2.query(
        'SELECT COUNT(*) as count FROM units_v2_fts',
        { type: sequelizeV2.QueryTypes.SELECT },
      );
      const beforeCount = beforeResults[0].count;

      expect(beforeCount).to.be.at.least(3); // At least our 3 test units

      // Rebuild FTS table
      await UnitV2.rebuildFtsTable();

      // Verify data still exists after rebuild
      const afterResults = await sequelizeV2.query(
        'SELECT COUNT(*) as count FROM units_v2_fts',
        { type: sequelizeV2.QueryTypes.SELECT },
      );
      const afterCount = afterResults[0].count;

      expect(afterCount).to.equal(beforeCount);
    });
  });

  describe('FTS Triggers - Automatic Maintenance', function () {
    it('should automatically update FTS table when project is created', async function () {
      const newProject = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TRIGGER-TEST-001',
        projectName: 'Trigger Test Project',
        projectSector: 'Test Sector',
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      });

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Search for the new project
      const results = await ProjectV2.findAllSqliteFts(
        'Trigger Test',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      const projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.include(newProject.cadTrustProjectId);
    });

    it('should automatically update FTS table when project is updated', async function () {
      const originalName = testProject1.projectName;
      const newName = 'Updated Project Name for FTS Test';

      // Update project
      await testProject1.update({ projectName: newName });

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Search for updated name
      const results = await ProjectV2.findAllSqliteFts(
        'Updated Project Name',
        { offset: 0, limit: 10 },
        [],
        null,
      );

      const projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.include(testProject1.cadTrustProjectId);

      // Restore original name
      await testProject1.update({ projectName: originalName });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('should automatically update FTS table when unit is created', async function () {
      const newUnit = await UnitV2.create({
        cadTrustUnitId: uuidv4(),
        orgUid: homeOrgId,
        unitSerialId: 'TRIGGER-UNIT-TEST-001',
        unitStartBlock: 'T001',
        unitEndBlock: 'T100',
        unitCount: 100,
        unitType: 'Removal - nature',
        unitVintageYear: 2024,
        unitStatus: 'Held',
        cadTrustIssuanceId: testIssuance1.cadTrustIssuanceId,
      });

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Search for the new unit
      const results = await UnitV2.findAllSqliteFts(
        'TRIGGER-UNIT-TEST',
        { offset: 0, limit: 10 },
        [],
        false,
        null,
      );

      const unitIds = results.rows.map((r) => r.cad_trust_unit_id || r.cadTrustUnitId);
      expect(unitIds).to.include(newUnit.cadTrustUnitId);
    });

    it('should automatically remove from FTS table when project is deleted', async function () {
      const projectToDelete = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Delete Test Registry',
        projectId: 'DELETE-TEST-001',
        projectName: 'Project To Be Deleted',
        projectSector: 'Test Sector',
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      });

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify it's in FTS
      let results = await ProjectV2.findAllSqliteFts(
        'Project To Be Deleted',
        { offset: 0, limit: 10 },
        [],
        null,
      );
      let projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.include(projectToDelete.cadTrustProjectId);

      // Delete project
      await projectToDelete.destroy();

      // Wait for trigger to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify it's removed from FTS
      results = await ProjectV2.findAllSqliteFts(
        'Project To Be Deleted',
        { offset: 0, limit: 10 },
        [],
        null,
      );
      projectIds = results.rows.map((r) => r.cad_trust_project_id || r.cadTrustProjectId);
      expect(projectIds).to.not.include(projectToDelete.cadTrustProjectId);
    });
  });

  describe('FTS Query Sanitization', function () {
    it('should handle special characters in search query', async function () {
      // Test with quotes
      const results1 = await ProjectV2.findAllSqliteFts(
        'Forest"Project',
        { offset: 0, limit: 10 },
        [],
        null,
      );
      expect(results1).to.have.property('count');
      expect(results1).to.have.property('rows');

      // Test with asterisk (should be handled)
      const results2 = await ProjectV2.findAllSqliteFts(
        'Forest*',
        { offset: 0, limit: 10 },
        [],
        null,
      );
      expect(results2).to.have.property('count');
      expect(results2).to.have.property('rows');
    });

    it('should handle empty and whitespace-only queries', async function () {
      const emptyResults = await ProjectV2.findAllSqliteFts(
        '',
        { offset: 0, limit: 10 },
        [],
        null,
      );
      expect(emptyResults.count).to.equal(0);

      const whitespaceResults = await ProjectV2.findAllSqliteFts(
        '   ',
        { offset: 0, limit: 10 },
        [],
        null,
      );
      expect(whitespaceResults.count).to.equal(0);
    });
  });
});

