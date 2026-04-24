import { expect } from 'chai';
import xlsx from 'node-xlsx';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
} from './helpers/live-api-helpers.js';
import { getSharedRequest } from './helpers/shared-setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Replace {{PLACEHOLDER}} strings in every cell of a parsed XLSX workbook.
 * Returns a new buffer built from the modified sheets.
 */
function replaceXlsxPlaceholders(filePath, replacements) {
  const buffer = readFileSync(filePath);
  const sheets = xlsx.parse(buffer);

  for (const sheet of sheets) {
    for (let r = 0; r < sheet.data.length; r++) {
      for (let c = 0; c < sheet.data[r].length; c++) {
        const cell = sheet.data[r][c];
        if (typeof cell === 'string') {
          let replaced = cell;
          for (const [placeholder, value] of Object.entries(replacements)) {
            replaced = replaced.replace(placeholder, value);
          }
          sheet.data[r][c] = replaced;
        }
      }
    }

    // Drop data rows that still contain unresolved {{...}} placeholders
    // (header row at index 0 is always kept)
    if (sheet.data.length > 1) {
      sheet.data = [sheet.data[0], ...sheet.data.slice(1).filter((row) =>
        !row.some((cell) => typeof cell === 'string' && /\{\{.+?\}\}/.test(cell)),
      )];
    }
  }

  return xlsx.build(sheets);
}

/**
 * Parse an XLSX response buffer into { sheetName: { headers, rows } } for easy assertions.
 */
function parseXlsxResponse(responseBody) {
  const sheets = xlsx.parse(responseBody);
  const result = {};
  for (const sheet of sheets) {
    if (sheet.data.length < 1) continue;
    const headers = sheet.data[0];
    const rows = sheet.data.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = i < row.length ? row[i] : undefined;
      });
      return obj;
    });
    result[sheet.name] = { headers, rows };
  }
  return result;
}

describe('XLSX Import/Export Live API Tests', function () {
  this.timeout(1800000);

  let request;

  // Prerequisite IDs discovered from the live database
  let programId;
  let methodologyId;
  let stakeholderId;
  let validationId;
  let issuanceId;
  let labelId;

  before(async function () {
    request = getSharedRequest();

    const REQUIRED_TYPES = ['program', 'methodology', 'issuance', 'label'];
    const OPTIONAL_TYPES = ['stakeholder', 'validation'];
    const PK_FIELDS = {
      program: 'cadTrustProgramId',
      methodology: 'cadTrustMethodologyId',
      stakeholder: 'cadTrustStakeholderId',
      validation: 'cadTrustValidationId',
      issuance: 'cadTrustIssuanceId',
      label: 'cadTrustLabelId',
    };

    async function fetchFirstId(type, attempt = 1) {
      const maxAttempts = 3;
      const pkField = PK_FIELDS[type];
      try {
        const response = await request.get(`/v2/${type}`).query({ page: 1, limit: 10 });
        if (response.status !== 200) {
          console.error(`  [attempt ${attempt}] GET /v2/${type} returned status ${response.status}: ${JSON.stringify(response.body)}`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            return fetchFirstId(type, attempt + 1);
          }
          return null;
        }
        const data = Array.isArray(response.body)
          ? response.body
          : (response.body?.data || []);
        if (data.length === 0) {
          console.error(`  [attempt ${attempt}] GET /v2/${type} returned 200 but 0 records`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            return fetchFirstId(type, attempt + 1);
          }
          return null;
        }
        const id = pkField ? data[0][pkField] : null;
        if (!id) {
          console.error(`  [attempt ${attempt}] GET /v2/${type} returned ${data.length} record(s) but first record missing ${pkField}. Keys: ${Object.keys(data[0]).join(', ')}`);
        }
        return id || null;
      } catch (error) {
        console.error(`  [attempt ${attempt}] GET /v2/${type} threw: ${error.message}`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          return fetchFirstId(type, attempt + 1);
        }
        return null;
      }
    }

    console.log('Discovering XLSX test prerequisites...');
    for (const type of [...REQUIRED_TYPES, ...OPTIONAL_TYPES]) {
      const id = await fetchFirstId(type);
      switch (type) {
        case 'program': programId = id; break;
        case 'methodology': methodologyId = id; break;
        case 'stakeholder': stakeholderId = id; break;
        case 'validation': validationId = id; break;
        case 'issuance': issuanceId = id; break;
        case 'label': labelId = id; break;
      }
    }

    const missing = REQUIRED_TYPES.filter((t) => {
      const ids = { program: programId, methodology: methodologyId, issuance: issuanceId, label: labelId };
      return !ids[t];
    });
    if (missing.length > 0) {
      throw new Error(
        'XLSX tests require prerequisite records. Missing after 3 attempts: ' + missing.join(', '),
      );
    }

    console.log('XLSX test prerequisites:');
    console.log(`  programId:      ${programId}`);
    console.log(`  methodologyId:  ${methodologyId}`);
    console.log(`  stakeholderId:  ${stakeholderId || '(none)'}`);
    console.log(`  validationId:   ${validationId || '(none)'}`);
    console.log(`  issuanceId:     ${issuanceId}`);
    console.log(`  labelId:        ${labelId}`);
  });

  // =========================================================================
  // XLSX Import (Projects + Units batched into a single commit)
  // =========================================================================
  let importedProjectIds = [];
  let importedUnitIds = [];

  describe('Step 11: XLSX Import (batch)', function () {
    it('should import sample-projects-import.xlsx with placeholder replacement', async function () {
      const replacements = {
        '{{PROGRAM_ID}}': programId,
        '{{METHODOLOGY_ID}}': methodologyId,
        ...(stakeholderId && { '{{STAKEHOLDER_ID}}': stakeholderId }),
        ...(validationId && { '{{VALIDATION_ID}}': validationId }),
      };

      const xlsxBuffer = replaceXlsxPlaceholders(
        join(__dirname, 'data', 'sample-projects-import.xlsx'),
        replacements,
      );

      const response = await request
        .put('/v2/project/xlsx')
        .attach('xlsx', xlsxBuffer, 'sample-projects-import.xlsx');

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('Updates from xlsx added to staging');
    });

    it('should import sample-units-import.xlsx with placeholder replacement', async function () {
      const replacements = {
        '{{ISSUANCE_ID}}': issuanceId,
        '{{LABEL_ID}}': labelId,
      };

      const xlsxBuffer = replaceXlsxPlaceholders(
        join(__dirname, 'data', 'sample-units-import.xlsx'),
        replacements,
      );

      const response = await request
        .put('/v2/unit/xlsx')
        .attach('xlsx', xlsxBuffer, 'sample-units-import.xlsx');

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
    });

    it('should commit all staged XLSX imports and verify they appear', async function () {
      await commitStagedRecords(request, [], true);
      await waitForPendingCommits(request);
      await waitForStagingEmpty(request);
    });
  });

  describe('Step 11a: Verify imported projects', function () {
    it('should find all imported projects in database', async function () {
      const listResponse = await request
        .get('/v2/project')
        .query({ page: 1, limit: 1000 });
      const projects = listResponse.body?.data || listResponse.body || [];

      const sampleProjectIds = [
        'SAMPLE-PRJ-2024-001',
        'SAMPLE-PRJ-2024-002',
        'SAMPLE-PRJ-2025-003',
      ];

      for (const sampleId of sampleProjectIds) {
        const project = projects.find((p) => p.projectId === sampleId);
        expect(project, `Project ${sampleId} not found in database`).to.exist;
        importedProjectIds.push(project.cadTrustProjectId);
      }

      // Verify fields on the first project (fully populated)
      const p1 = projects.find((p) => p.projectId === 'SAMPLE-PRJ-2024-001');
      expect(p1.projectName).to.equal('Example Mangrove Restoration Project');
      expect(p1.projectRegistryName).to.equal('Sample Global Registry');
      expect(p1.projectStatus).to.equal('Registered');
      expect(p1.projectUnitMetric).to.equal('tCO2e');

      // Verify minimal project
      const p2 = projects.find((p) => p.projectId === 'SAMPLE-PRJ-2024-002');
      expect(p2.projectName).to.equal('Sample Solar Cookstove Distribution');
      expect(p2.projectRegistryName).to.equal('Example Standards Body');

      // Verify project with program reference
      const p3 = projects.find((p) => p.projectId === 'SAMPLE-PRJ-2025-003');
      expect(p3.projectName).to.equal('Example Improved Forest Management');
      if (programId) {
        expect(p3.cadTrustProgramId).to.equal(programId);
      }
    });

    it('should verify child entities were imported for projects', async function () {
      const locResponse = await request
        .get('/v2/location')
        .query({ page: 1, limit: 1000 });
      const locations = locResponse.body?.data || locResponse.body || [];
      const xlsxLocations = locations.filter((l) =>
        importedProjectIds.includes(l.cadTrustProjectId),
      );
      expect(xlsxLocations.length).to.be.at.least(4);

      const vnLocation = xlsxLocations.find(
        (l) => l.locationCountry === 'Viet Nam' && l.locationRegion === 'Example Delta Region',
      );
      expect(vnLocation, 'Vietnam location not found').to.exist;

      const estResponse = await request
        .get('/v2/estimation')
        .query({ page: 1, limit: 1000 });
      const estimations = estResponse.body?.data || estResponse.body || [];
      const xlsxEstimations = estimations.filter((e) =>
        importedProjectIds.includes(e.cadTrustProjectId),
      );
      expect(xlsxEstimations.length).to.be.at.least(5);

      const cbResponse = await request
        .get('/v2/co-benefit')
        .query({ page: 1, limit: 1000 });
      const coBenefits = cbResponse.body?.data || cbResponse.body || [];
      const xlsxCoBenefits = coBenefits.filter((cb) =>
        importedProjectIds.includes(cb.cadTrustProjectId),
      );
      expect(xlsxCoBenefits.length).to.be.at.least(9);

      const ratingResponse = await request
        .get('/v2/rating')
        .query({ page: 1, limit: 1000 });
      const ratings = ratingResponse.body?.data || ratingResponse.body || [];
      const xlsxRatings = ratings.filter((r) =>
        importedProjectIds.includes(r.cadTrustProjectId),
      );
      expect(xlsxRatings.length).to.be.at.least(3);
    });
  });

  describe('Step 12a: Verify imported units', function () {
    it('should find all imported units in database', async function () {
      const listResponse = await request
        .get('/v2/unit')
        .query({ page: 1, limit: 1000 });
      const units = listResponse.body?.data || listResponse.body || [];

      const sampleSerialIds = [
        'SAMPLE-UNIT1-BLK-1000-5000',
        'SAMPLE-UNIT2-BLK-5001-7000',
        'SAMPLE-UNIT3-BLK-1-2500',
        'SAMPLE-UNIT4-BLK-1-10000',
      ];

      for (const serialId of sampleSerialIds) {
        const unit = units.find((u) => u.unitSerialId === serialId);
        expect(unit, `Unit ${serialId} not found in database`).to.exist;
        importedUnitIds.push(unit.cadTrustUnitId);
      }

      // Verify fields on unit 1
      const u1 = units.find((u) => u.unitSerialId === 'SAMPLE-UNIT1-BLK-1000-5000');
      expect(u1.unitStartBlock).to.equal('1000');
      expect(u1.unitEndBlock).to.equal('5000');
      expect(u1.unitType).to.equal('Removal - nature');
      expect(Number(u1.unitVintageYear)).to.equal(2024);
      expect(u1.unitStatus).to.equal('Issued');
      expect(u1.cadTrustIssuanceId).to.equal(issuanceId);

      // Verify retired unit
      const u2 = units.find((u) => u.unitSerialId === 'SAMPLE-UNIT2-BLK-5001-7000');
      expect(u2.unitStatus).to.equal('Retired');
      expect(u2.unitRetirementBeneficiary).to.equal('Example Corporation');

      // Verify marketplace-listed unit
      const u4 = units.find((u) => u.unitSerialId === 'SAMPLE-UNIT4-BLK-1-10000');
      expect(u4.marketplace).to.equal('Example Marketplace');
      expect(u4.marketplaceIdentifier).to.equal('SAMPLE-MKT-UNIT4-001');
    });

    it('should verify unitLabels child records were imported', async function () {
      const labelResponse = await request
        .get('/v2/unit-label')
        .query({ page: 1, limit: 1000 });
      const unitLabels = labelResponse.body?.data || labelResponse.body || [];

      const xlsxLabels = unitLabels.filter((ul) =>
        importedUnitIds.includes(ul.cadTrustUnitId),
      );
      expect(xlsxLabels.length).to.be.at.least(2);

      for (const ul of xlsxLabels) {
        expect(ul.cadTrustLabelId).to.equal(labelId);
      }
    });
  });

  // =========================================================================
  // Project XLSX Export
  // =========================================================================
  describe('Step 13: Project XLSX Export', function () {
    it('should export projects as XLSX with correct sheets and data', async function () {
      const response = await request
        .get('/v2/project')
        .query({ xls: 'true' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).to.equal(200);
      expect(response.headers['content-disposition']).to.include('.xlsx');

      const parsed = parseXlsxResponse(response.body);
      expect(parsed).to.have.property('projects');

      // Verify all DB projects appear in the export
      const dbResponse = await request
        .get('/v2/project')
        .query({ page: 1, limit: 1000 });
      const dbProjects = dbResponse.body?.data || dbResponse.body || [];

      expect(parsed.projects.rows.length).to.equal(dbProjects.length);

      // Verify every project from DB appears in the export
      for (const dbProject of dbProjects) {
        const exportRow = parsed.projects.rows.find(
          (r) => r.cadTrustProjectId === dbProject.cadTrustProjectId,
        );
        expect(
          exportRow,
          `Project ${dbProject.cadTrustProjectId} not in export`,
        ).to.exist;
        expect(exportRow.projectName).to.equal(dbProject.projectName);
        expect(exportRow.projectRegistryName).to.equal(dbProject.projectRegistryName);
      }

      // Verify child sheets exist (at least locations and estimations from our import)
      expect(parsed).to.have.property('locations');
      expect(parsed.locations.rows.length).to.be.at.least(4);
      expect(parsed).to.have.property('estimations');
      expect(parsed.estimations.rows.length).to.be.at.least(5);
    });
  });

  // =========================================================================
  // Unit XLSX Export
  // =========================================================================
  describe('Step 14: Unit XLSX Export', function () {
    it('should export units as XLSX with correct sheets and data', async function () {
      const response = await request
        .get('/v2/unit')
        .query({ xls: 'true' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).to.equal(200);
      expect(response.headers['content-disposition']).to.include('.xlsx');

      const parsed = parseXlsxResponse(response.body);
      expect(parsed).to.have.property('units');

      const dbResponse = await request
        .get('/v2/unit')
        .query({ page: 1, limit: 1000 });
      const dbUnits = dbResponse.body?.data || dbResponse.body || [];

      expect(parsed.units.rows.length).to.equal(dbUnits.length);

      for (const dbUnit of dbUnits) {
        const exportRow = parsed.units.rows.find(
          (r) => r.cadTrustUnitId === dbUnit.cadTrustUnitId,
        );
        expect(
          exportRow,
          `Unit ${dbUnit.cadTrustUnitId} not in export`,
        ).to.exist;
        expect(exportRow.unitSerialId).to.equal(dbUnit.unitSerialId);
      }

      // Verify unitLabels child sheet
      if (parsed.unitLabels) {
        expect(parsed.unitLabels.rows.length).to.be.at.least(2);
      }
    });
  });

  // =========================================================================
  // Round-trip Fidelity (batched into a single commit)
  // =========================================================================
  let beforeProjects = [];
  let beforeUnits = [];

  describe('Step 15: Round-trip re-import (batch)', function () {
    it('should export and re-import project XLSX', async function () {
      const exportResponse = await request
        .get('/v2/project')
        .query({ xls: 'true' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(exportResponse.status).to.equal(200);

      const beforeResponse = await request
        .get('/v2/project')
        .query({ page: 1, limit: 1000 });
      beforeProjects = beforeResponse.body?.data || beforeResponse.body || [];

      const importResponse = await request
        .put('/v2/project/xlsx')
        .attach('xlsx', exportResponse.body, 'roundtrip-projects.xlsx');

      expect(importResponse.status).to.equal(200);
      expect(importResponse.body.success).to.be.true;
    });

    it('should export and re-import unit XLSX', async function () {
      const exportResponse = await request
        .get('/v2/unit')
        .query({ xls: 'true' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(exportResponse.status).to.equal(200);

      const beforeResponse = await request
        .get('/v2/unit')
        .query({ page: 1, limit: 1000 });
      beforeUnits = beforeResponse.body?.data || beforeResponse.body || [];

      const importResponse = await request
        .put('/v2/unit/xlsx')
        .attach('xlsx', exportResponse.body, 'roundtrip-units.xlsx');

      expect(importResponse.status).to.equal(200);
      expect(importResponse.body.success).to.be.true;
    });

  });

  describe('Step 15a: Verify round-trip fidelity', function () {
    it('should verify projects match after round-trip', async function () {
      const afterResponse = await request
        .get('/v2/project')
        .query({ page: 1, limit: 1000 });
      const afterProjects = afterResponse.body?.data || afterResponse.body || [];

      expect(afterProjects.length).to.equal(beforeProjects.length);

      for (const before of beforeProjects) {
        const after = afterProjects.find(
          (p) => p.cadTrustProjectId === before.cadTrustProjectId,
        );
        expect(after, `Project ${before.cadTrustProjectId} missing after round-trip`).to.exist;
        expect(after.projectName).to.equal(before.projectName);
        expect(after.projectRegistryName).to.equal(before.projectRegistryName);
        expect(after.projectId).to.equal(before.projectId);
      }
    });

    it('should verify units match after round-trip', async function () {
      const afterResponse = await request
        .get('/v2/unit')
        .query({ page: 1, limit: 1000 });
      const afterUnits = afterResponse.body?.data || afterResponse.body || [];

      expect(afterUnits.length).to.equal(beforeUnits.length);

      for (const before of beforeUnits) {
        const after = afterUnits.find(
          (u) => u.cadTrustUnitId === before.cadTrustUnitId,
        );
        expect(after, `Unit ${before.cadTrustUnitId} missing after round-trip`).to.exist;
        expect(after.unitSerialId).to.equal(before.unitSerialId);
        expect(after.unitType).to.equal(before.unitType);
      }
    });
  });

  // =========================================================================
  // Export with Filters
  // =========================================================================
  describe('Step 16: Export with Filters', function () {
    it('should export only home org projects when orgUid=me', async function () {
      const response = await request
        .get('/v2/project')
        .query({ xls: 'true', orgUid: 'me' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).to.equal(200);

      const parsed = parseXlsxResponse(response.body);
      expect(parsed).to.have.property('projects');

      // All exported projects should belong to the home org
      const dbResponse = await request
        .get('/v2/project')
        .query({ orgUid: 'me', page: 1, limit: 1000 });
      const homeProjects = dbResponse.body?.data || dbResponse.body || [];

      expect(parsed.projects.rows.length).to.equal(homeProjects.length);
    });

    it('should export filtered results when search term is provided', async function () {
      const response = await request
        .get('/v2/project')
        .query({ xls: 'true', search: 'Mangrove' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).to.equal(200);

      const parsed = parseXlsxResponse(response.body);
      expect(parsed).to.have.property('projects');

      // Should have at least our mangrove project
      expect(parsed.projects.rows.length).to.be.at.least(1);

      // Verify the search term appears in exported data
      const hasMangrove = parsed.projects.rows.some(
        (r) =>
          (r.projectName && r.projectName.includes('Mangrove')) ||
          (r.projectDescription && r.projectDescription.includes('mangrove')),
      );
      expect(hasMangrove).to.be.true;
    });
  });
});
