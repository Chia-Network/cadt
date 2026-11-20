import { expect } from 'chai';
import supertest from 'supertest';
import sinon from 'sinon';
import { Op } from 'sequelize';
import xlsx from 'node-xlsx';
import app from '../../../src/server.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import {
  ProjectV2,
  ProgramV2,
  LocationV2,
  ValidationV2,
  VerificationV2,
  StagingV2,
} from '../../../src/models/v2/index.js';
import {
  verifyTestDatabaseConfiguration,
  pauseSchedulerTasks,
  resumeSchedulerTasks,
  resetV2DataTables,
  resetV2StagingTable,
  createV2TestHomeOrg,
  withConfigOverride,
} from '../utils/v2-test-helpers.js';

const id = (number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const validationIds = [id(103), id(101), id(102)];
const verificationIds = [id(203), id(201), id(202)];
const list = (query = {}) =>
  supertest(app)
    .get('/v2/project')
    .query({ page: 1, limit: 10, order: 'projectName:ASC', ...query });

function expectIds(project, validations, verifications) {
  expect(project.cadTrustValidationIds).to.deep.equal(validations);
  expect(project.cadTrustVerificationIds).to.deep.equal(verifications);
  expect(project).not.to.have.property('validations');
  expect(project).not.to.have.property('verifications');
}

describe('V2 Project related ID read enrichment', function () {
  this.timeout(30000);
  let homeOrgId;

  before(async function () {
    await verifyTestDatabaseConfiguration();
    await pauseSchedulerTasks();
    await prepareV2Db();
    homeOrgId = (await createV2TestHomeOrg()).org_uid;
  });

  after(async function () {
    await resumeSchedulerTasks();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
    await ProgramV2.create({
      cadTrustProgramId: id(90),
      programName: 'Related IDs program',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'RELATED-ACTIVITY',
    });
    for (let index = 0; index < 3; index++) {
      await ProjectV2.create({
        cadTrustProjectId: id(index + 1),
        projectRegistryName: 'Test Registry',
        projectId: `RELATED-${index}`,
        projectName: [
          'A Relatedforest empty',
          'B Relatedforest single',
          'C Relatedforest multiple',
        ][index],
        projectSector: ['Agriculture'],
        cadTrustProgramId: id(90),
        orgUid: index === 2 ? 'other-org' : homeOrgId,
      });
    }
    await LocationV2.create({
      cadTrustLocationId: id(80),
      cadTrustProjectId: id(3),
      locationCountry: 'United States',
    });
    await ValidationV2.create({
      cadTrustValidationId: id(100),
      validationId: 'single',
      cadTrustProjectId: id(2),
      createdByOrgUid: 'other-creator',
    });
    await VerificationV2.create({
      cadTrustVerificationId: id(200),
      verificationId: 'single',
      cadTrustProjectId: id(2),
      cadTrustValidationId: id(100),
      createdByOrgUid: 'other-creator',
    });
    for (const validationId of validationIds) {
      await ValidationV2.create({
        cadTrustValidationId: validationId,
        validationId,
        cadTrustProjectId: id(3),
      });
    }
    for (const verificationId of verificationIds) {
      await VerificationV2.create({
        cadTrustVerificationId: verificationId,
        verificationId,
        cadTrustProjectId: id(3),
        cadTrustValidationId: id(101),
      });
    }
  });

  it('returns all IDs in deterministic ascending order and empty arrays on list and by ID', async function () {
    const response = await list().expect(200);
    expect(response.body.pageCount).to.equal(1);
    expect(response.body.data).to.have.length(3);
    const expected = [
      [[], []],
      [[id(100)], [id(200)]],
      [[...validationIds].sort(), [...verificationIds].sort()],
    ];
    for (let index = 0; index < 3; index++) {
      const [validations, verifications] = expected[index];
      expectIds(response.body.data[index], validations, verifications);
      const single = await supertest(app)
        .get(`/v2/project/${id(index + 1)}`)
        .expect(200);
      expectIds(single.body, validations, verifications);
    }
  });

  it('preserves distinct project counts, zero-child roots and page membership', async function () {
    for (const [page, expectedIds] of [
      [1, [id(1), id(2)]],
      [2, [id(3)]],
    ]) {
      const response = await list({ page, limit: 2 }).expect(200);
      expect(response.body.pageCount).to.equal(2);
      expect(
        response.body.data.map((project) => project.cadTrustProjectId),
      ).to.deep.equal(expectedIds);
      for (const project of response.body.data) {
        expect(project)
          .to.have.property('cadTrustValidationIds')
          .that.is.an('array');
        expect(project)
          .to.have.property('cadTrustVerificationIds')
          .that.is.an('array');
      }
    }
    const emptyPage = await list({ page: 3, limit: 2 }).expect(200);
    expect(emptyPage.body.pageCount).to.equal(2);
    expect(emptyPage.body.data).to.deep.equal([]);
  });

  for (const field of ['cadTrustValidationIds', 'cadTrustVerificationIds']) {
    it(`projects only ${field} without exposing unrequested base columns`, async function () {
      const response = await list({ columns: field, projectIds: id(3) }).expect(
        200,
      );
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0]).to.deep.equal({
        [field]:
          field === 'cadTrustValidationIds'
            ? [...validationIds].sort()
            : [...verificationIds].sort(),
      });
    });
  }

  it('supports selected base columns and both computed arrays together', async function () {
    const response = await list({
      columns: [
        'projectName',
        'cadTrustValidationIds',
        'cadTrustVerificationIds',
      ],
      projectIds: id(3),
    }).expect(200);
    expect(response.body.data[0]).to.deep.equal({
      projectName: 'C Relatedforest multiple',
      cadTrustValidationIds: [...validationIds].sort(),
      cadTrustVerificationIds: [...verificationIds].sort(),
    });
  });

  it('omits unrequested arrays and preserves by-ID base fields with columns', async function () {
    const response = await list({ columns: 'projectName' }).expect(200);
    expect(response.body.data[0]).to.deep.equal({
      projectName: 'A Relatedforest empty',
    });
    const selected = await supertest(app)
      .get(`/v2/project/${id(3)}`)
      .query({ columns: 'cadTrustVerificationIds' })
      .expect(200);
    expect(selected.body).to.have.property('cadTrustProjectId', id(3));
    expect(selected.body).to.have.property(
      'projectName',
      'C Relatedforest multiple',
    );
    expect(selected.body.cadTrustVerificationIds).to.deep.equal(
      [...verificationIds].sort(),
    );
    expect(selected.body).not.to.have.property('cadTrustValidationIds');
    const baseOnly = await supertest(app)
      .get(`/v2/project/${id(3)}`)
      .query({ columns: 'projectName' })
      .expect(200);
    expect(baseOnly.body).not.to.have.property('cadTrustValidationIds');
    expect(baseOnly.body).not.to.have.property('cadTrustVerificationIds');
  });

  it('preserves search, organization, projectIds and filter selection', async function () {
    const response = await list({
      search: 'Relatedforest',
      orgUid: 'me',
      columns: 'projectName,cadTrustValidationIds',
    }).expect(200);
    expect(
      response.body.data.map((project) => project.projectName),
    ).to.deep.equal(['A Relatedforest empty', 'B Relatedforest single']);
    expect(response.body.data[0].cadTrustValidationIds).to.deep.equal([]);
    expect(response.body.data[1].cadTrustValidationIds).to.deep.equal([
      id(100),
    ]);
    expect(response.body.data[1]).not.to.have.property(
      'cadTrustVerificationIds',
    );
    const filtered = await list({
      projectIds: `${id(2)},${id(3)}`,
      filter: 'projectName:C Relatedforest multiple:eq',
      orgUid: 'other-org',
    }).expect(200);
    expect(
      filtered.body.data.map((project) => project.cadTrustProjectId),
    ).to.deep.equal([id(3)]);
    expectIds(
      filtered.body.data[0],
      [...validationIds].sort(),
      [...verificationIds].sort(),
    );
  });

  for (const columns of [
    'program,cadTrustValidationIds',
    ['program', 'cadTrustVerificationIds'],
    ['ProgramV2', 'cadTrustValidationIds', 'cadTrustVerificationIds'],
  ]) {
    it(`preserves association-only projection for ${columns}`, async function () {
      const baseline = await list({
        columns: 'program',
        projectIds: id(3),
      }).expect(200);
      const project = baseline.body.data[0];
      expect(project.cadTrustProjectId).to.equal(id(3));
      expect(project.projectName).to.equal('C Relatedforest multiple');
      expect(project.program.cadTrustProgramId).to.equal(id(90));
      const expectedProject = { ...project };
      if (columns.includes('cadTrustValidationIds')) {
        expectedProject.cadTrustValidationIds = [...validationIds].sort();
      }
      if (columns.includes('cadTrustVerificationIds')) {
        expectedProject.cadTrustVerificationIds = [...verificationIds].sort();
      }
      const response = await list({ columns, projectIds: id(3) }).expect(200);
      expect(response.body).to.deep.equal({
        ...baseline.body,
        data: [expectedProject],
      });
    });
  }

  it('keeps explicit base and association projections narrow with computed arrays', async function () {
    const baseline = await list({
      columns: 'program',
      projectIds: id(3),
    }).expect(200);
    const response = await list({
      columns:
        'projectName,program,cadTrustValidationIds,cadTrustVerificationIds',
      projectIds: id(3),
    }).expect(200);
    expect(response.body.data).to.deep.equal([
      {
        projectName: 'C Relatedforest multiple',
        program: baseline.body.data[0].program,
        cadTrustValidationIds: [...validationIds].sort(),
        cadTrustVerificationIds: [...verificationIds].sort(),
      },
    ]);
  });

  it('preserves requested program and location associations with computed arrays', async function () {
    const columns =
      'cadTrustProjectId,program,cadTrustValidationIds,cadTrustVerificationIds';
    const response = await list({ columns }).expect(200);
    expect(response.body.data).to.have.length(3);
    expect(response.body.pageCount).to.equal(1);
    const project = response.body.data[2];
    expect(project.program.cadTrustProgramId).to.equal(id(90));
    expectIds(project, [...validationIds].sort(), [...verificationIds].sort());
    const single = await supertest(app)
      .get(`/v2/project/${id(3)}`)
      .query({ columns: `${columns},locations` })
      .expect(200);
    expect(single.body.program.cadTrustProgramId).to.equal(id(90));
    expect(single.body.locations).to.have.length(1);
    expectIds(
      single.body,
      [...validationIds].sort(),
      [...verificationIds].sort(),
    );
  });

  it('uses one ID-only read per child table for the page and no reads for unrequested arrays', async function () {
    const validationReads = sinon.spy(ValidationV2, 'findAll');
    const verificationReads = sinon.spy(VerificationV2, 'findAll');
    try {
      const response = await list().expect(200);
      expect(response.body.data).to.have.length(3);
      expect(validationReads.callCount).to.equal(1);
      expect(verificationReads.callCount).to.equal(1);
      expect(validationReads.firstCall.args[0].attributes).to.have.members([
        'cadTrustProjectId',
        'cadTrustValidationId',
      ]);
      expect(verificationReads.firstCall.args[0].attributes).to.have.members([
        'cadTrustProjectId',
        'cadTrustVerificationId',
      ]);
      expect(
        validationReads.firstCall.args[0].where.cadTrustProjectId[Op.in],
      ).to.deep.equal([id(1), id(2), id(3)]);
      expect(
        verificationReads.firstCall.args[0].where.cadTrustProjectId[Op.in],
      ).to.deep.equal([id(1), id(2), id(3)]);
      validationReads.resetHistory();
      verificationReads.resetHistory();
      await list({ page: 2, limit: 2 }).expect(200);
      expect(validationReads.callCount).to.equal(1);
      expect(verificationReads.callCount).to.equal(1);
      expect(
        validationReads.firstCall.args[0].where.cadTrustProjectId[Op.in],
      ).to.deep.equal([id(3)]);
      expect(
        verificationReads.firstCall.args[0].where.cadTrustProjectId[Op.in],
      ).to.deep.equal([id(3)]);
      validationReads.resetHistory();
      verificationReads.resetHistory();
      await list({ columns: 'projectName' }).expect(200);
      expect(validationReads.callCount).to.equal(0);
      expect(verificationReads.callCount).to.equal(0);
      await list({ columns: 'cadTrustValidationIds' }).expect(200);
      expect(validationReads.callCount).to.equal(1);
      expect(verificationReads.callCount).to.equal(0);
      validationReads.resetHistory();
      await list({ page: 3, limit: 2 }).expect(200);
      expect(validationReads.callCount).to.equal(0);
      expect(verificationReads.callCount).to.equal(0);
    } finally {
      validationReads.restore();
      verificationReads.restore();
    }
  });

  it('keeps computed arrays out of loaded project model serialization', async function () {
    const projectReads = sinon.spy(ProjectV2, 'findAll');
    try {
      await list().expect(200);
      const projects = await projectReads.firstCall.returnValue;
      expect(projects).to.have.length(3);
      for (const project of projects) {
        expect(project.toJSON()).not.to.have.property('cadTrustValidationIds');
        expect(project.toJSON()).not.to.have.property(
          'cadTrustVerificationIds',
        );
      }
    } finally {
      projectReads.restore();
    }
  });

  it('reads committed data in read-only mode without staging or persisting computed fields', async function () {
    await StagingV2.create({
      uuid: id(999),
      table: 'validation',
      action: 'INSERT',
      committed: false,
      data: JSON.stringify([
        {
          cad_trust_validation_id: id(999),
          validation_id: 'staged-only',
          cad_trust_project_id: id(1),
        },
      ]),
    });
    const before = await Promise.all([
      ProjectV2.findAll({ raw: true }),
      ValidationV2.findAll({ raw: true }),
      VerificationV2.findAll({ raw: true }),
      StagingV2.findAll({ raw: true }),
    ]);
    await withConfigOverride(
      async () => {
        const response = await list().expect(200);
        expectIds(response.body.data[0], [], []);
        expectIds(
          response.body.data[2],
          [...validationIds].sort(),
          [...verificationIds].sort(),
        );
        const single = await supertest(app)
          .get(`/v2/project/${id(3)}`)
          .expect(200);
        expectIds(
          single.body,
          [...validationIds].sort(),
          [...verificationIds].sort(),
        );
      },
      { APP: { READ_ONLY: true } },
    );
    const after = await Promise.all([
      ProjectV2.findAll({ raw: true }),
      ValidationV2.findAll({ raw: true }),
      VerificationV2.findAll({ raw: true }),
      StagingV2.findAll({ raw: true }),
    ]);
    expect(after).to.deep.equal(before);
    const attributes = await sequelizeV2
      .getQueryInterface()
      .describeTable('project');
    expect(attributes).not.to.have.property('cad_trust_validation_ids');
    expect(attributes).not.to.have.property('cad_trust_verification_ids');
  });

  it('rejects computed arrays in project POST and PUT payloads', async function () {
    const payload = {
      projectRegistryName: 'Test Registry',
      projectId: 'RELATED-WRITE',
      projectName: 'Read-only arrays',
      projectLink: 'https://example.com/project',
      projectSector: ['Agriculture'],
      projectType: ['Landfill gas'],
      projectStatus: 'Listed',
      projectStatusDate: '2024-01-01',
      projectUnitMetric: 'tCO2e',
    };
    for (const method of ['post', 'put']) {
      const path = method === 'post' ? '/v2/project' : `/v2/project/${id(2)}`;
      for (const field of [
        'cadTrustValidationIds',
        'cadTrustVerificationIds',
      ]) {
        const request = supertest(app);
        const response = await request[method](path)
          .send({ ...payload, [field]: [id(100)] })
          .expect(400);
        expect(JSON.stringify(response.body)).to.include(field);
      }
    }
    expect(await StagingV2.count()).to.equal(0);
  });

  it('keeps XLS project columns and child sheets unchanged', async function () {
    const response = await supertest(app)
      .get('/v2/project')
      .query({ xls: true })
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const sheets = xlsx.parse(response.body);
    const projects = sheets.find((sheet) => sheet.name === 'projects');
    expect(projects.data).to.have.length(4);
    expect(projects.data[0]).not.to.include('cadTrustValidationIds');
    expect(projects.data[0]).not.to.include('cadTrustVerificationIds');
    expect(sheets.map((sheet) => sheet.name)).to.include.members([
      'validations',
      'verifications',
    ]);
  });

  it('keeps a missing project response at 404', async function () {
    await supertest(app)
      .get(`/v2/project/${id(999)}`)
      .expect(404);
  });
});
