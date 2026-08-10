import { expect } from 'chai';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  ProjectV2,
  ProgramV2,
  StagingV2,
} from '../../../src/models/v2/index.js';
import { Simulator } from '../../../src/models/index.js';
import TaskManager from '../../../src/tasks/index.js';
import { validateStagedRecord } from '../../../src/utils/v2-staging-validation.js';
import { stageV2XlsRecords } from '../../../src/utils/v2-xls.js';
import { encodeHex, decodeHex } from '../../../src/utils/datalayer-utils.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
} from '../utils/v2-test-helpers.js';
import {
  initializePicklists,
  getRandomPicklistValue,
  getInvalidPicklistValue,
} from '../utils/v2-picklist-test-helpers.js';

const buildValidProjectRecord = (overrides = {}) => ({
  projectRegistryName: 'Validation Test Registry',
  projectId: `VAL-${uuidv4().slice(0, 8)}`,
  projectName: 'Validation Test Project',
  projectLink: 'https://example.com/project',
  projectSector: [getRandomPicklistValue('projectSector')],
  projectType: [getRandomPicklistValue('projectType')],
  projectStatus: getRandomPicklistValue('projectStatus'),
  projectStatusDate: '2024-01-01',
  projectUnitMetric: getRandomPicklistValue('projectUnitMetric'),
  ...overrides,
});

describe('V2 Staging Validation', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
    TaskManager.stopAll();
    await createV2TestHomeOrg();
    await initializePicklists();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  describe('validateStagedRecord', function () {
    it('returns no errors for a complete valid record', async function () {
      const errors = await validateStagedRecord(
        ProjectV2,
        buildValidProjectRecord(),
      );
      expect(errors).to.deep.equal([]);
    });

    it('reports every missing required field', async function () {
      const errors = await validateStagedRecord(ProjectV2, {
        projectName: 'Only A Name',
      });

      const joined = errors.join('; ');
      expect(joined).to.include('projectRegistryName');
      expect(joined).to.include('projectId');
      expect(joined).to.include('projectLink');
      expect(joined).to.include('projectSector');
      expect(joined).to.include('projectStatus');
    });

    it('rejects picklist values the REST API would reject', async function () {
      const errors = await validateStagedRecord(
        ProjectV2,
        buildValidProjectRecord({
          projectStatus: getInvalidPicklistValue('projectStatus'),
        }),
      );
      expect(errors.join('; ')).to.include('does not include a valid option');
    });

    it('rejects a foreign key that resolves to nothing', async function () {
      const errors = await validateStagedRecord(
        ProjectV2,
        buildValidProjectRecord({ cadTrustProgramId: uuidv4() }),
      );
      expect(errors.join('; ')).to.include('cadTrustProgramId');
    });

    it('accepts a foreign key that exists in the database', async function () {
      const program = await ProgramV2.create({
        programName: 'FK Target Program',
        programRegistry: 'Test',
        programRegistryActivityId: 'FK-TARGET',
      });

      const errors = await validateStagedRecord(
        ProjectV2,
        buildValidProjectRecord({
          cadTrustProgramId: program.cadTrustProgramId,
        }),
      );
      expect(errors).to.deep.equal([]);
    });

    it('accepts a foreign key staged in the same import batch', async function () {
      const batchProgramId = uuidv4();
      const errors = await validateStagedRecord(
        ProjectV2,
        buildValidProjectRecord({ cadTrustProgramId: batchProgramId }),
        { batchPks: { program: new Set([batchProgramId]) } },
      );
      expect(errors).to.deep.equal([]);
    });

    it('skips FK checks when checkForeignKeys is false', async function () {
      const errors = await validateStagedRecord(
        ProjectV2,
        buildValidProjectRecord({ cadTrustProgramId: uuidv4() }),
        { checkForeignKeys: false },
      );
      expect(errors).to.deep.equal([]);
    });

    it('errors when a model has no registered schema', async function () {
      const errors = await validateStagedRecord(
        class UnknownModel {},
        {},
        { checkForeignKeys: false },
      );
      expect(errors.join('; ')).to.include('No validation schema registered');
    });
  });

  describe('CSV batch upload parity with the REST API', function () {
    // Picklist entries can contain commas, so every value has to be quoted.
    const toCsv = (record) => {
      const keys = Object.keys(record);
      const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
      const value = (key) =>
        quote(
          Array.isArray(record[key]) ? record[key].join('|') : record[key],
        );
      return Buffer.from(
        `${keys.join(',')}\n${keys.map(value).join(',')}`,
        'utf8',
      );
    };

    const postProject = (record) =>
      supertest(app).post('/v2/project').send(record);

    const batchProject = (record) =>
      supertest(app)
        .post('/v2/project/batch')
        .attach('csv', toCsv(record), 'parity.csv');

    it('rejects an invalid picklist value on both paths', async function () {
      const record = buildValidProjectRecord({
        projectStatus: getInvalidPicklistValue('projectStatus'),
      });

      const apiResponse = await postProject(record);
      expect(apiResponse.status).to.equal(400);

      const batchResponse = await batchProject(record);
      expect(batchResponse.status).to.equal(400);
      expect(batchResponse.body.stagedCount).to.equal(0);
      expect(batchResponse.body.errors[0].error).to.include('projectStatus');

      expect(await StagingV2.count({ where: { table: 'project' } })).to.equal(0);
    });

    it('rejects a malformed projectLink on both paths', async function () {
      const record = buildValidProjectRecord({ projectLink: 'not-a-url' });

      const apiResponse = await postProject(record);
      expect(apiResponse.status).to.equal(400);

      const batchResponse = await batchProject(record);
      expect(batchResponse.status).to.equal(400);
      expect(batchResponse.body.errors[0].error).to.include('projectLink');

      expect(await StagingV2.count({ where: { table: 'project' } })).to.equal(0);
    });

    it('rejects an unresolvable foreign key on both paths', async function () {
      const record = buildValidProjectRecord({ cadTrustProgramId: uuidv4() });

      const apiResponse = await postProject(record);
      expect(apiResponse.status).to.equal(400);

      const batchResponse = await batchProject(record);
      expect(batchResponse.status).to.equal(400);
      expect(batchResponse.body.errors[0].error).to.include('cadTrustProgramId');

      expect(await StagingV2.count({ where: { table: 'project' } })).to.equal(0);
    });

    it('accepts a record both paths consider valid', async function () {
      const record = buildValidProjectRecord();

      const apiResponse = await postProject(record);
      expect(apiResponse.status).to.equal(200);

      await resetV2StagingTable();

      const batchResponse = await batchProject(record);
      expect(batchResponse.status).to.equal(200);
      expect(batchResponse.body.stagedCount).to.equal(1);
      expect(batchResponse.body.errorCount).to.equal(0);
    });

    it('accepts an INSERT row that leaves an optional column blank', async function () {
      const record = buildValidProjectRecord({ projectDescription: '' });

      const batchResponse = await batchProject(record);
      expect(batchResponse.status).to.equal(200);
      expect(batchResponse.body.stagedCount).to.equal(1);
      expect(batchResponse.body.errorCount).to.equal(0);
    });

    it('stages a blank cell as null rather than as an empty string', async function () {
      const record = buildValidProjectRecord({
        projectDescription: '',
        cadTrustProgramId: '',
      });

      expect((await batchProject(record)).status).to.equal(200);

      const staged = await StagingV2.findOne({
        where: { table: 'project' },
        raw: true,
      });
      const [stagedRecord] = JSON.parse(staged.data);
      expect(stagedRecord.project_description).to.be.null;
      expect(stagedRecord.cad_trust_program_id).to.be.null;
    });

    it('accepts an UPDATE row that blanks an optional column', async function () {
      const project = await ProjectV2.create(
        addUuidIfNeeded('ProjectV2', {
          ...buildValidProjectRecord(),
          orgUid: await getV2HomeOrgId(),
          projectDescription: 'Set by the seed record',
        }),
      );
      await resetV2StagingTable();

      const batchResponse = await batchProject({
        cadTrustProjectId: project.cadTrustProjectId,
        projectDescription: '',
      });
      expect(batchResponse.status).to.equal(200);
      expect(batchResponse.body.stagedCount).to.equal(1);
      expect(batchResponse.body.errorCount).to.equal(0);
    });

    it('reports a blank required column as missing rather than as empty', async function () {
      const record = buildValidProjectRecord({ projectName: '' });

      const batchResponse = await batchProject(record);
      expect(batchResponse.status).to.equal(400);
      expect(batchResponse.body.errors[0].error).to.include(
        '"projectName" is required',
      );
    });
  });

  describe('StagingV2.assertChangeListNotNullCompleteness', function () {
    // Build a complete DB-field-named record covering every NOT NULL column.
    const buildCompleteDbRecord = (ModelClass) => {
      const record = {};
      for (const [attrName, meta] of Object.entries(ModelClass.rawAttributes)) {
        if (meta.allowNull === false) {
          record[meta.field || attrName] = 'x';
        }
      }
      return record;
    };

    const insertChange = (table, uuid, record) => ({
      action: 'insert',
      key: encodeHex(`${table}|${uuid}`),
      value: encodeHex(JSON.stringify(record)),
    });

    it('passes a changelist whose inserts cover all NOT NULL fields', function () {
      const changeList = [
        insertChange('project', uuidv4(), buildCompleteDbRecord(ProjectV2)),
      ];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.not.throw();
    });

    it('rejects an insert missing a NOT NULL field', function () {
      const record = buildCompleteDbRecord(ProjectV2);
      delete record.project_name;

      const changeList = [insertChange('project', uuidv4(), record)];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.throw(/project_name/);
    });

    it('accepts an empty-string NOT NULL field (satisfies allowNull on re-ingest)', function () {
      const record = buildCompleteDbRecord(ProjectV2);
      record.project_registry_name = '';

      const changeList = [insertChange('project', uuidv4(), record)];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.not.throw();
    });

    it('ignores insert changes without a value', function () {
      const changeList = [
        { action: 'insert', key: encodeHex(`project|${uuidv4()}`) },
      ];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.not.throw();
    });

    it('ignores delete actions', function () {
      const changeList = [
        { action: 'delete', key: encodeHex(`project|${uuidv4()}`) },
      ];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.not.throw();
    });

    it('ignores metadata keys without a table separator', function () {
      const changeList = [
        {
          action: 'insert',
          key: encodeHex('comment'),
          value: encodeHex(JSON.stringify({ comment: 'a commit comment' })),
        },
      ];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.not.throw();
    });

    it('ignores tables it does not manage', function () {
      const changeList = [
        {
          action: 'insert',
          key: encodeHex(`sometable|${uuidv4()}`),
          value: encodeHex(JSON.stringify({ anything: true })),
        },
      ];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.not.throw();
    });

    it('rejects change values that are not valid JSON', function () {
      const changeList = [
        {
          action: 'insert',
          key: encodeHex(`project|${uuidv4()}`),
          value: encodeHex('not-json'),
        },
      ];
      expect(() =>
        StagingV2.assertChangeListNotNullCompleteness(changeList),
      ).to.throw(/not valid JSON/);
    });
  });

  describe('commit-time gate wiring', function () {
    it('refuses to commit a staged record missing a NOT NULL field', async function () {
      // Bypass write-path validation to prove the gate itself protects the
      // commit: a record without program_name must never reach the chain.
      const programId = uuidv4();
      await StagingV2.upsert({
        uuid: programId,
        action: 'INSERT',
        table: 'program',
        data: JSON.stringify([
          {
            cad_trust_program_id: programId,
            program_registry: 'Gate Test Registry',
            program_registry_activity_id: 'GATE-001',
          },
        ]),
      });

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({ comment: 'gate test', author: 'Test User' });

      expect(response.status).to.equal(400);
      expect(response.body.success).to.equal(false);
      expect(response.body.error).to.match(/program_name/);

      const staged = await StagingV2.findOne({ where: { uuid: programId } });
      expect(staged.committed).to.equal(false);
    });

    it('commits a staged project to the simulated chain without dropping fields', async function () {
      // Guards changelist fidelity: every field in the staged data must
      // appear verbatim in the on-chain record. The commit pipeline's XLS
      // transformation silently drops object-valued columns, so staging a
      // field in the wrong shape shows up here as a missing on-chain key.
      const projectId = uuidv4();
      const parsedData = {
        main: [buildValidProjectRecord({ cadTrustProjectId: projectId })],
        children: {},
      };
      await stageV2XlsRecords(parsedData, ProjectV2);

      const staged = await StagingV2.findOne({
        where: { uuid: projectId },
        raw: true,
      });
      const stagedData = JSON.parse(staged.data)[0];

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({ comment: 'fidelity test', author: 'Test User' });
      expect(response.status).to.equal(200);

      // The datalayer push is fire-and-forget, so poll the simulator store.
      const keySuffix = `_${encodeHex(`project|${projectId}`)}`;
      let onChainRow = null;
      for (let attempt = 0; attempt < 40 && !onChainRow; attempt++) {
        const rows = await Simulator.findAll({ raw: true });
        onChainRow = rows.find((row) => row.key.endsWith(keySuffix));
        if (!onChainRow) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      expect(onChainRow, 'committed project must reach the simulated chain').to
        .exist;

      const onChainRecord = JSON.parse(decodeHex(onChainRow.value));
      for (const [field, stagedValue] of Object.entries(stagedData)) {
        expect(
          onChainRecord,
          `on-chain record must include staged field '${field}'`,
        ).to.have.property(field);
        expect(onChainRecord[field], `field '${field}' must survive commit`).to.equal(
          stagedValue,
        );
      }

      // Array fields specifically: staged as JSON strings, preserved verbatim.
      expect(onChainRecord.project_sector).to.equal(stagedData.project_sector);
      expect(JSON.parse(onChainRecord.project_sector)).to.be.an('array');
    });
  });
});
