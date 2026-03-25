import { expect } from 'chai';
import xlsx from 'node-xlsx';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  ProjectV2,
  UnitV2,
  LocationV2,
  EstimationV2,
  UnitLabelV2,
  LabelV2,
  IssuanceV2,
  ProgramV2,
  ValidationV2,
  VerificationV2,
  MethodologyV2,
  ProjectMethodologyV2,
  StagingV2,
} from '../../../src/models/v2/index.js';
import TaskManager from '../../../src/tasks/index.js';
import {
  buildXlsSchema,
  createV2Xls,
  parseV2Xlsx,
  stageV2XlsRecords,
} from '../../../src/utils/v2-xls.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
  createV2TestProgramChain,
} from '../utils/v2-test-helpers.js';

describe('V2 XLS Utility Functions', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
    TaskManager.stopAll();
    await createV2TestHomeOrg();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  describe('buildXlsSchema', function () {
    it('should return correct schema for ProjectV2', function () {
      const schema = buildXlsSchema(ProjectV2);

      expect(schema.mainSheetName).to.equal('projects');
      expect(schema.mainPK).to.equal('cadTrustProjectId');
      expect(schema.modelSheetKey).to.equal('ProjectV2');
      expect(schema.model).to.equal(ProjectV2);

      expect(schema.children).to.be.an('array');
      const childNames = schema.children.map((c) => c.sheetName);
      expect(childNames).to.include.members([
        'locations',
        'estimations',
        'ratings',
        'coBenefits',
        'validations',
        'verifications',
        'projectMethodologies',
        'stakeholderProjects',
      ]);

      schema.children.forEach((child) => {
        expect(child).to.have.property('model');
        expect(child).to.have.property('primaryKey');
        expect(child).to.have.property('foreignKey');
        expect(child).to.have.property('tableName');
      });
    });

    it('should return correct schema for UnitV2', function () {
      const schema = buildXlsSchema(UnitV2);

      expect(schema.mainSheetName).to.equal('units');
      expect(schema.mainPK).to.equal('cadTrustUnitId');
      expect(schema.modelSheetKey).to.equal('UnitV2');
      expect(schema.model).to.equal(UnitV2);

      const childNames = schema.children.map((c) => c.sheetName);
      expect(childNames).to.include('unitLabels');
    });

    it('should include correct foreignKey and tableName for children', function () {
      const schema = buildXlsSchema(ProjectV2);
      const locationChild = schema.children.find(
        (c) => c.sheetName === 'locations',
      );

      expect(locationChild).to.exist;
      expect(locationChild.foreignKey).to.equal('cadTrustProjectId');
      expect(locationChild.primaryKey).to.equal('cadTrustLocationId');
      expect(locationChild.model).to.equal(LocationV2);
    });
  });

  describe('parseV2Xlsx', function () {
    it('should parse a single main sheet with plural name', function () {
      const projectId = uuidv4();
      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
            [projectId, 'Test Project', 'Test Registry'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(1);
      expect(result.main[0].cadTrustProjectId).to.equal(projectId);
      expect(result.main[0].projectName).to.equal('Test Project');
      expect(result.main[0].projectRegistryName).to.equal('Test Registry');
      expect(result.children).to.deep.equal({});
    });

    it('should parse a single main sheet with singular name', function () {
      const projectId = uuidv4();
      const buffer = xlsx.build([
        {
          name: 'project',
          data: [
            ['cadTrustProjectId', 'projectName'],
            [projectId, 'Singular Sheet Project'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(1);
      expect(result.main[0].projectName).to.equal('Singular Sheet Project');
    });

    it('should parse a sheet using model name (e.g. ProjectV2)', function () {
      const projectId = uuidv4();
      const buffer = xlsx.build([
        {
          name: 'ProjectV2',
          data: [
            ['cadTrustProjectId', 'projectName'],
            [projectId, 'Model Name Sheet'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(1);
      expect(result.main[0].projectName).to.equal('Model Name Sheet');
    });

    it('should parse multi-sheet buffer with main + children', function () {
      const projectId = uuidv4();
      const locationId = uuidv4();
      const estimationId = uuidv4();

      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName'],
            [projectId, 'Multi Sheet Project'],
          ],
        },
        {
          name: 'locations',
          data: [
            [
              'cadTrustLocationId',
              'locationCountry',
              'cadTrustProjectId',
            ],
            [locationId, 'US', projectId],
          ],
        },
        {
          name: 'estimations',
          data: [
            ['cadTrustEstimationId', 'estimationUnitCount', 'cadTrustProjectId'],
            [estimationId, '1000', projectId],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);

      expect(result.main).to.have.lengthOf(1);
      expect(result.main[0].projectName).to.equal('Multi Sheet Project');

      expect(result.children).to.have.property('locations');
      expect(result.children.locations).to.have.lengthOf(1);
      expect(result.children.locations[0].locationCountry).to.equal('US');
      expect(result.children.locations[0].cadTrustProjectId).to.equal(projectId);

      expect(result.children).to.have.property('estimations');
      expect(result.children.estimations).to.have.lengthOf(1);
      expect(result.children.estimations[0].estimationUnitCount).to.equal('1000');
    });

    it('should accept singular child sheet names', function () {
      const projectId = uuidv4();
      const locationId = uuidv4();

      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName'],
            [projectId, 'Test'],
          ],
        },
        {
          name: 'location',
          data: [
            ['cadTrustLocationId', 'locationCountry', 'cadTrustProjectId'],
            [locationId, 'UK', projectId],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.children).to.have.property('locations');
      expect(result.children.locations).to.have.lengthOf(1);
      expect(result.children.locations[0].locationCountry).to.equal('UK');
    });

    it('should replace NEW-<digit> placeholders with UUIDs', function () {
      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName'],
            ['NEW-1', 'Placeholder Project 1'],
            ['NEW-2', 'Placeholder Project 2'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(2);
      result.main.forEach((row) => {
        expect(row.cadTrustProjectId).to.not.include('NEW-');
        expect(row.cadTrustProjectId).to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
      });
      expect(result.main[0].cadTrustProjectId).to.not.equal(
        result.main[1].cadTrustProjectId,
      );
    });

    it('should convert "null" string values to null', function () {
      const projectId = uuidv4();
      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName', 'projectLink'],
            [projectId, 'Null Test', 'null'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main[0].projectLink).to.be.null;
    });

    it('should skip sheets with fewer than 2 rows', function () {
      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [['cadTrustProjectId', 'projectName']],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(0);
    });

    it('should skip unrecognized sheet names', function () {
      const projectId = uuidv4();
      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName'],
            [projectId, 'Main Project'],
          ],
        },
        {
          name: 'foobar',
          data: [
            ['col1', 'col2'],
            ['val1', 'val2'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(1);
      expect(Object.keys(result.children)).to.not.include('foobar');
    });

    it('should handle unit XLSX with unitLabels child sheet', function () {
      const unitId = uuidv4();
      const labelId = uuidv4();

      const buffer = xlsx.build([
        {
          name: 'units',
          data: [
            ['cadTrustUnitId', 'unitSerialId'],
            [unitId, 'UL-UNIT-001'],
          ],
        },
        {
          name: 'unitLabels',
          data: [
            ['cadTrustUnitLabelId', 'cadTrustUnitId', 'cadTrustLabelId'],
            [uuidv4(), unitId, labelId],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, UnitV2);
      expect(result.main).to.have.lengthOf(1);
      expect(result.children).to.have.property('unitLabels');
      expect(result.children.unitLabels).to.have.lengthOf(1);
      expect(result.children.unitLabels[0].cadTrustUnitId).to.equal(unitId);
    });

    it('should handle multiple data rows per sheet', function () {
      const buffer = xlsx.build([
        {
          name: 'projects',
          data: [
            ['cadTrustProjectId', 'projectName'],
            [uuidv4(), 'Project A'],
            [uuidv4(), 'Project B'],
            [uuidv4(), 'Project C'],
          ],
        },
      ]);

      const result = parseV2Xlsx(buffer, ProjectV2);
      expect(result.main).to.have.lengthOf(3);
      expect(result.main.map((r) => r.projectName)).to.deep.equal([
        'Project A',
        'Project B',
        'Project C',
      ]);
    });
  });

  describe('createV2Xls', function () {
    it('should produce a parseable XLSX buffer for projects', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'XLS Export Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'XLS-ACT-001',
      });

      const project = await ProjectV2.create(
        addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'XLS-EXP-001',
          projectName: 'XLS Export Project',
          projectSector: ['Agriculture'],
          cadTrustProgramId: program.cadTrustProgramId,
          orgUid: homeOrgId,
        }),
      );

      const rows = await ProjectV2.findAll({
        include: buildXlsSchema(ProjectV2).children.map((child) => ({
          model: child.model,
          as: child.sheetName,
          required: false,
        })),
        raw: false,
      });

      const plainRows = rows.map((r) => r.toJSON());
      const buffer = createV2Xls(plainRows, ProjectV2);

      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(buffer.length).to.be.greaterThan(0);

      const parsed = xlsx.parse(buffer);
      const sheetNames = parsed.map((s) => s.name);
      expect(sheetNames).to.include('projects');

      const mainSheet = parsed.find((s) => s.name === 'projects');
      expect(mainSheet.data.length).to.be.at.least(2);

      const headers = mainSheet.data[0];
      expect(headers).to.include('cadTrustProjectId');
      expect(headers).to.include('projectName');

      const firstRow = mainSheet.data[1];
      const projectNameIdx = headers.indexOf('projectName');
      expect(firstRow[projectNameIdx]).to.equal('XLS Export Project');
    });

    it('should produce a parseable XLSX buffer for units', async function () {
      const chain = await createV2TestProgramChain({ testId: 'xls-unit' });
      const homeOrgId = await getV2HomeOrgId();

      await UnitV2.create(
        addUuidIfNeeded('UnitV2', {
          unitSerialId: 'XLS-UNIT-001',
          unitStartBlock: '100',
          unitEndBlock: '200',
          unitCount: 50,
          unitVintageYear: 2024,
          cadTrustIssuanceId: chain.issuance.cadTrustIssuanceId,
          orgUid: homeOrgId,
        }),
      );

      const rows = await UnitV2.findAll({
        include: buildXlsSchema(UnitV2).children.map((child) => ({
          model: child.model,
          as: child.sheetName,
          required: false,
        })),
        raw: false,
      });

      const plainRows = rows.map((r) => r.toJSON());
      const buffer = createV2Xls(plainRows, UnitV2);

      const parsed = xlsx.parse(buffer);
      const sheetNames = parsed.map((s) => s.name);
      expect(sheetNames).to.include('units');

      const mainSheet = parsed.find((s) => s.name === 'units');
      expect(mainSheet.data.length).to.be.at.least(2);

      const headers = mainSheet.data[0];
      expect(headers).to.include('cadTrustUnitId');
      expect(headers).to.include('unitSerialId');
    });

    it('should include child sheets when children exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Child Sheet Program',
        programRegistry: 'Test',
        programRegistryActivityId: 'CHILD-ACT',
      });

      const project = await ProjectV2.create(
        addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test',
          projectId: 'CHILD-001',
          projectName: 'Project With Children',
          projectSector: ['Energy'],
          cadTrustProgramId: program.cadTrustProgramId,
          orgUid: homeOrgId,
        }),
      );

      await LocationV2.create(
        addUuidIfNeeded('LocationV2', {
          locationCountry: 'US',
          locationRegion: 'California',
          cadTrustProjectId: project.cadTrustProjectId,
        }),
      );

      await EstimationV2.create({
        cadTrustEstimationId: uuidv4(),
        estimationUnitCount: 5000,
        estimationStartDate: '2024-01-01',
        estimationEndDate: '2024-12-31',
        cadTrustProjectId: project.cadTrustProjectId,
      });

      const rows = await ProjectV2.findAll({
        include: buildXlsSchema(ProjectV2).children.map((child) => ({
          model: child.model,
          as: child.sheetName,
          required: false,
        })),
        raw: false,
      });

      const plainRows = rows.map((r) => r.toJSON());
      const buffer = createV2Xls(plainRows, ProjectV2);

      const parsed = xlsx.parse(buffer);
      const sheetNames = parsed.map((s) => s.name);
      expect(sheetNames).to.include('projects');
      expect(sheetNames).to.include('locations');
      expect(sheetNames).to.include('estimations');

      const locSheet = parsed.find((s) => s.name === 'locations');
      expect(locSheet.data.length).to.be.at.least(2);
      const locHeaders = locSheet.data[0];
      expect(locHeaders).to.include('locationCountry');
    });
  });

  describe('stageV2XlsRecords', function () {
    it('should create staging INSERT records for new parent rows', async function () {
      const projectId = uuidv4();
      const parsedData = {
        main: [
          {
            cadTrustProjectId: projectId,
            projectName: 'Staged Project',
            projectRegistryName: 'Test',
          },
        ],
        children: {},
      };

      await stageV2XlsRecords(parsedData, ProjectV2);

      const records = await StagingV2.findAll({ where: { table: 'project' } });
      expect(records).to.have.lengthOf(1);
      expect(records[0].uuid).to.equal(projectId);
      expect(records[0].action).to.equal('INSERT');

      const data = JSON.parse(records[0].data);
      expect(data[0].project_name).to.equal('Staged Project');
    });

    it('should create staging UPDATE records for existing rows', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Stage Update Program',
        programRegistry: 'Test',
        programRegistryActivityId: 'STAGE-UPD',
      });

      const project = await ProjectV2.create(
        addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Old Registry',
          projectId: 'STAGE-001',
          projectName: 'Old Name',
          projectSector: ['Agriculture'],
          cadTrustProgramId: program.cadTrustProgramId,
          orgUid: homeOrgId,
        }),
      );

      const parsedData = {
        main: [
          {
            cadTrustProjectId: project.cadTrustProjectId,
            projectName: 'Updated Name',
          },
        ],
        children: {},
      };

      await stageV2XlsRecords(parsedData, ProjectV2);

      const records = await StagingV2.findAll({
        where: { table: 'project', uuid: project.cadTrustProjectId },
      });
      expect(records).to.have.lengthOf(1);
      expect(records[0].action).to.equal('UPDATE');

      const data = JSON.parse(records[0].data);
      expect(data[0].project_name).to.equal('Updated Name');
      // Should merge with existing record
      expect(data[0].project_registry_name).to.equal('Old Registry');
    });

    it('should stage child rows independently', async function () {
      const projectId = uuidv4();
      const locationId = uuidv4();

      const parsedData = {
        main: [
          {
            cadTrustProjectId: projectId,
            projectName: 'Parent Project',
            projectRegistryName: 'Test',
          },
        ],
        children: {
          locations: [
            {
              cadTrustLocationId: locationId,
              locationCountry: 'US',
              cadTrustProjectId: projectId,
            },
          ],
        },
      };

      await stageV2XlsRecords(parsedData, ProjectV2);

      const parentRecords = await StagingV2.findAll({
        where: { table: 'project' },
      });
      expect(parentRecords).to.have.lengthOf(1);

      const childRecords = await StagingV2.findAll({
        where: { table: 'location' },
      });
      expect(childRecords).to.have.lengthOf(1);
      expect(childRecords[0].uuid).to.equal(locationId);
      expect(childRecords[0].action).to.equal('INSERT');

      const childData = JSON.parse(childRecords[0].data);
      expect(childData[0].location_country).to.equal('US');
    });

    it('should skip empty rows', async function () {
      const projectId = uuidv4();
      const parsedData = {
        main: [
          {
            cadTrustProjectId: projectId,
            projectName: 'Valid Row',
            projectRegistryName: 'Test',
          },
          { cadTrustProjectId: '', projectName: '', projectRegistryName: '' },
        ],
        children: {},
      };

      await stageV2XlsRecords(parsedData, ProjectV2);

      const records = await StagingV2.findAll({ where: { table: 'project' } });
      expect(records).to.have.lengthOf(1);
    });

    it('should assign UUIDs to rows without primary key', async function () {
      const parsedData = {
        main: [
          {
            projectName: 'No PK Project',
            projectRegistryName: 'Test',
          },
        ],
        children: {},
      };

      await stageV2XlsRecords(parsedData, ProjectV2);

      const records = await StagingV2.findAll({ where: { table: 'project' } });
      expect(records).to.have.lengthOf(1);
      expect(records[0].uuid).to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(records[0].action).to.equal('INSERT');
    });
  });

  describe('sample XLSX fixture validation', function () {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const fixtureDir = join(__dirname, '..', 'live-api', 'data');

    it('should have consistent parent-child FK linkage in sample-projects-import.xlsx', function () {
      const buffer = readFileSync(join(fixtureDir, 'sample-projects-import.xlsx'));
      const result = parseV2Xlsx(buffer, ProjectV2);

      expect(result.main.length).to.be.at.least(1);

      const parentPKs = new Set(result.main.map((r) => r.cadTrustProjectId));

      expect(parentPKs.size).to.equal(result.main.length,
        'Each parent project should have a unique cadTrustProjectId');

      for (const pk of parentPKs) {
        expect(pk).to.exist.and.to.not.be.empty;
        expect(pk).to.not.include('NEW-',
          'NEW-<digit> placeholders should have been replaced with UUIDs');
      }

      for (const [sheetName, rows] of Object.entries(result.children)) {
        for (const row of rows) {
          if (row.cadTrustProjectId) {
            expect(parentPKs.has(row.cadTrustProjectId),
              `${sheetName} row FK ${row.cadTrustProjectId} must match a parent project PK`).to.be.true;
          }
        }
      }
    });

    it('should have consistent parent-child FK linkage in sample-units-import.xlsx', function () {
      const buffer = readFileSync(join(fixtureDir, 'sample-units-import.xlsx'));
      const result = parseV2Xlsx(buffer, UnitV2);

      expect(result.main.length).to.be.at.least(1);

      const parentPKs = new Set(result.main.map((r) => r.cadTrustUnitId));

      expect(parentPKs.size).to.equal(result.main.length,
        'Each parent unit should have a unique cadTrustUnitId');

      for (const pk of parentPKs) {
        expect(pk).to.exist.and.to.not.be.empty;
        expect(pk).to.not.include('NEW-',
          'NEW-<digit> placeholders should have been replaced with UUIDs');
      }

      for (const [sheetName, rows] of Object.entries(result.children)) {
        for (const row of rows) {
          if (row.cadTrustUnitId) {
            expect(parentPKs.has(row.cadTrustUnitId),
              `${sheetName} row FK ${row.cadTrustUnitId} must match a parent unit PK`).to.be.true;
          }
        }
      }
    });

    it('should produce valid staging records from sample-projects-import.xlsx', async function () {
      const buffer = readFileSync(join(fixtureDir, 'sample-projects-import.xlsx'));
      const parsed = parseV2Xlsx(buffer, ProjectV2);

      await stageV2XlsRecords(parsed, ProjectV2);

      const projectRecords = await StagingV2.findAll({ where: { table: 'project' } });
      expect(projectRecords.length).to.equal(parsed.main.length);

      const stagedPKs = new Set(projectRecords.map((r) => r.uuid));

      const childTables = ['location', 'estimation', 'rating', 'co_benefit',
        'validation', 'verification', 'project_methodology', 'stakeholder_projects'];

      for (const table of childTables) {
        const childRecords = await StagingV2.findAll({ where: { table } });
        for (const rec of childRecords) {
          const data = JSON.parse(rec.data)[0];
          if (data.cadTrustProjectId) {
            expect(stagedPKs.has(data.cadTrustProjectId),
              `${table} staged record FK ${data.cadTrustProjectId} must match a staged project PK`).to.be.true;
          }
        }
      }
    });
  });

  describe('round-trip: createV2Xls → parseV2Xlsx', function () {
    it('should round-trip project data through export and re-import', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Round Trip Program',
        programRegistry: 'Test',
        programRegistryActivityId: 'RT-ACT',
      });

      const project = await ProjectV2.create(
        addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'RT Registry',
          projectId: 'RT-001',
          projectName: 'Round Trip Project',
          projectSector: ['Agriculture'],
          projectType: ['Forestry'],
          cadTrustProgramId: program.cadTrustProgramId,
          orgUid: homeOrgId,
        }),
      );

      await LocationV2.create(
        addUuidIfNeeded('LocationV2', {
          locationCountry: 'DE',
          locationRegion: 'Bavaria',
          cadTrustProjectId: project.cadTrustProjectId,
        }),
      );

      const rows = await ProjectV2.findAll({
        include: buildXlsSchema(ProjectV2).children.map((child) => ({
          model: child.model,
          as: child.sheetName,
          required: false,
        })),
        raw: false,
      });
      const plainRows = rows.map((r) => r.toJSON());
      const buffer = createV2Xls(plainRows, ProjectV2);

      const reimported = parseV2Xlsx(buffer, ProjectV2);

      expect(reimported.main).to.have.lengthOf(1);
      expect(reimported.main[0].cadTrustProjectId).to.equal(
        project.cadTrustProjectId,
      );
      expect(reimported.main[0].projectName).to.equal('Round Trip Project');

      expect(reimported.children).to.have.property('locations');
      expect(reimported.children.locations).to.have.lengthOf(1);
      expect(reimported.children.locations[0].locationCountry).to.equal('DE');
    });
  });
});
