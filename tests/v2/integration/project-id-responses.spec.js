import { expect } from 'chai';
import sinon from 'sinon';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../../src/server.js';
import scheduler from '../../../src/tasks/index.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import {
  IssuanceV2,
  ProjectMethodologyV2,
  ProjectV2,
  UnitV2,
  StagingV2,
} from '../../../src/models/v2/index.js';
import {
  createV2TestHomeOrg,
  createV2TestProgramChain,
  getV2HomeOrgId,
  resetV2DataTables,
  resetV2StagingTable,
  pauseSchedulerTasks,
  resumeSchedulerTasks,
  withConfigOverride,
} from '../utils/v2-test-helpers.js';

// Keep this suite's HTTP calls within their own client budget while retaining
// the production rate limiter. Restore the scoped proxy setting in after().
const apiRequest = Object.fromEntries(
  ['get', 'post', 'put'].map((method) => [
    method,
    (endpoint) =>
      supertest(app)[method](endpoint).set('X-Forwarded-For', '192.0.2.233'),
  ]),
);

const issuancePayload = (chain) => ({
  issuanceId: 'RESPONSE-ISSUANCE',
  cadTrustVerificationId: chain.verification.cadTrustVerificationId,
  cadTrustProjectMethodologyId:
    chain.projectMethodology.cadTrustProjectMethodologyId,
});
const unitPayload = (issuance) => ({
  unitSerialId: 'Responseunit',
  unitStartBlock: '1',
  unitEndBlock: '10',
  unitCount: 10,
  unitType: 'Avoidance - nature',
  unitVintageYear: 2024,
  unitStatus: 'Issued',
  unitStatusReason: 'Active',
  unitMetric: 'tCO2e',
  cadTrustIssuanceId: issuance.cadTrustIssuanceId,
});
const list = (table, query = {}) =>
  apiRequest
    .get(`/v2/${table}`)
    .query({ page: 1, limit: 10, ...query })
    .expect(200);
const snapshot = () =>
  Promise.all(
    [UnitV2, IssuanceV2, ProjectMethodologyV2, ProjectV2, StagingV2].map(
      (model) =>
        model.findAll({
          raw: true,
          order: [[model.primaryKeyAttribute, 'ASC']],
        }),
    ),
  );

describe('CAR-233 project IDs in unit and issuance responses', function () {
  this.timeout(30000);
  let chain;
  let unit;
  let schedulerStart;
  let trustProxy;
  before(async function () {
    trustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
    schedulerStart = sinon.stub(scheduler, 'start').resolves();
    await prepareV2Db();
    await pauseSchedulerTasks();
    await createV2TestHomeOrg();
  });
  after(async function () {
    app.set('trust proxy', trustProxy);
    schedulerStart.restore();
    await resumeSchedulerTasks();
  });
  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
    chain = await createV2TestProgramChain({ testId: 'PROJECT-RESPONSE' });
    unit = await UnitV2.create({
      ...unitPayload(chain.issuance),
      cadTrustUnitId: uuidv4(),
      orgUid: await getV2HomeOrgId(),
    });
  });

  for (const table of ['unit', 'issuance']) {
    it(`enriches ${table} list and detail via methodology, even when verification differs`, async function () {
      const other = await createV2TestProgramChain({ testId: 'OTHER' });
      await chain.issuance.update({
        cadTrustVerificationId: other.verification.cadTrustVerificationId,
      });
      const id =
        table === 'unit'
          ? unit.cadTrustUnitId
          : chain.issuance.cadTrustIssuanceId;
      const response = await list(table);
      const detail = await apiRequest.get(`/v2/${table}/${id}`).expect(200);
      const row = response.body.data.find(
        (item) =>
          item[table === 'unit' ? 'cadTrustUnitId' : 'cadTrustIssuanceId'] ===
          id,
      );
      expect(row.cadTrustProjectId).to.equal(chain.project.cadTrustProjectId);
      expect(detail.body.cadTrustProjectId).to.equal(
        chain.project.cadTrustProjectId,
      );
      expect(detail.body).to.not.have.any.keys(
        'project',
        'projectMethodology',
        'verification',
        'issuance',
      );
    });

    for (const missing of ['methodology', 'project']) {
      it(`returns null for ${table} when the ${missing} link is broken without verification fallback`, async function () {
        if (missing === 'methodology') {
          await chain.issuance.update({
            cadTrustProjectMethodologyId: uuidv4(),
          });
        } else {
          await chain.projectMethodology.update({
            cadTrustProjectId: uuidv4(),
          });
        }
        const id =
          table === 'unit'
            ? unit.cadTrustUnitId
            : chain.issuance.cadTrustIssuanceId;
        const response = await list(table);
        const detail = await apiRequest.get(`/v2/${table}/${id}`).expect(200);
        expect(response.body.data[0]).to.have.property(
          'cadTrustProjectId',
          null,
        );
        expect(detail.body).to.have.property('cadTrustProjectId', null);
      });
    }

    it(`keeps ${table} reads read-only and response-only`, async function () {
      const before = await snapshot();
      await withConfigOverride(
        async () => {
          const response = await list(table);
          expect(response.body.data[0].cadTrustProjectId).to.equal(
            chain.project.cadTrustProjectId,
          );
        },
        { APP: { READ_ONLY: true } },
      );
      expect(await snapshot()).to.deep.equal(before);
      expect(UnitV2.getAttributes()).to.not.have.property('cadTrustProjectId');
      expect(IssuanceV2.getAttributes()).to.not.have.property(
        'cadTrustProjectId',
      );
    });

    for (const method of ['post', 'put']) {
      it(`rejects response-only cadTrustProjectId on ${method.toUpperCase()} ${table}`, async function () {
        const id =
          table === 'unit'
            ? unit.cadTrustUnitId
            : chain.issuance.cadTrustIssuanceId;
        const payload =
          table === 'unit'
            ? unitPayload(chain.issuance)
            : issuancePayload(chain);
        const request = apiRequest[method](
          `/v2/${table}${method === 'put' ? `/${id}` : ''}`,
        );
        const response = await request
          .send({
            ...payload,
            cadTrustProjectId: chain.project.cadTrustProjectId,
          })
          .expect(400);
        expect(response.body.error).to.include('cadTrustProjectId');
        expect(await StagingV2.count()).to.equal(0);
      });
    }
  }

  it('returns null for a missing issuance without dropping the unit', async function () {
    await unit.update({ cadTrustIssuanceId: uuidv4() });
    const response = await list('unit');
    const detail = await apiRequest
      .get(`/v2/unit/${unit.cadTrustUnitId}`)
      .expect(200);
    expect(response.body.data[0]).to.have.property('cadTrustProjectId', null);
    expect(detail.body).to.have.property('cadTrustProjectId', null);
  });

  it('supports strict project-ID projections without exposing internal linkage', async function () {
    for (const columns of [
      'cadTrustProjectId',
      'unitSerialId,cadTrustProjectId',
      'cadTrustIssuanceId,cadTrustProjectId',
    ]) {
      const response = await list('unit', { columns });
      expect(response.body.data[0]).to.have.all.keys(columns.split(','));
      expect(response.body.data[0].cadTrustProjectId).to.equal(
        chain.project.cadTrustProjectId,
      );
    }
  });

  it('omits enrichment for other explicit columns and preserves association-only selection', async function () {
    const projected = await list('unit', { columns: 'unitSerialId' });
    expect(projected.body.data[0]).to.deep.equal({
      unitSerialId: unit.unitSerialId,
    });
    const association = await list('unit', { columns: 'issuance' });
    expect(association.body.data[0]).to.have.property(
      'unitSerialId',
      unit.unitSerialId,
    );
    expect(association.body.data[0]).to.not.have.any.keys(
      'cadTrustProjectId',
      'issuance',
    );
  });

  it('preserves base fields when association-only columns also request the project ID', async function () {
    for (const association of [
      'issuance',
      'IssuanceV2',
      'unitLabels',
      'UnitLabelV2',
    ]) {
      const baseline = await list('unit', { columns: association });
      for (const columns of [
        `${association},cadTrustProjectId`,
        [association, 'cadTrustProjectId'],
      ]) {
        const response = await list('unit', { columns });
        expect(response.body.data).to.deep.equal(
          baseline.body.data.map((row) => ({
            ...row,
            cadTrustProjectId: chain.project.cadTrustProjectId,
          })),
        );
      }
    }
  });

  it('combines project-ID projection with FTS and retains verification project search', async function () {
    const other = await createV2TestProgramChain({
      testId: 'SEARCH',
      projectName: 'Uniqueverificationproject',
    });
    await chain.issuance.update({
      cadTrustVerificationId: other.verification.cadTrustVerificationId,
    });
    for (const query of [
      { search: 'Responseunit' },
      { search: 'Uniqueverificationproject', includeProjectInfoInSearch: true },
    ]) {
      const response = await list('unit', {
        ...query,
        columns: 'unitSerialId,cadTrustProjectId',
      });
      expect(response.body.data).to.deep.equal([
        {
          unitSerialId: unit.unitSerialId,
          cadTrustProjectId: chain.project.cadTrustProjectId,
        },
      ]);
    }
  });

  it('enriches only the selected page in bounded queries and preserves unit ordering/counts', async function () {
    const other = await createV2TestProgramChain({ testId: 'OFF-PAGE' });
    await UnitV2.bulkCreate(
      ['A', 'B', 'Z'].map((serial) => ({
        ...unitPayload(serial === 'Z' ? other.issuance : chain.issuance),
        cadTrustUnitId: uuidv4(),
        unitSerialId: serial,
        orgUid: unit.orgUid,
      })),
    );
    const issuanceQueries = sinon.spy(IssuanceV2, 'findAll');
    const methodologyQueries = sinon.spy(ProjectMethodologyV2, 'findAll');
    const queries = sinon.spy(sequelizeV2, 'query');
    try {
      const response = await list('unit', {
        limit: 2,
        order: 'unitSerialId:ASC',
        orgUid: unit.orgUid,
      });
      expect(response.body.pageCount).to.equal(2);
      expect(response.body.data.map((row) => row.unitSerialId)).to.deep.equal([
        'A',
        'B',
      ]);
      expect(
        response.body.data.map((row) => row.cadTrustProjectId),
      ).to.deep.equal([
        chain.project.cadTrustProjectId,
        chain.project.cadTrustProjectId,
      ]);
      expect(issuanceQueries.callCount).to.equal(1);
      expect(methodologyQueries.callCount).to.equal(1);
      // Middleware also reads organization/staging state; bound entity queries only.
      const entityQueries = queries
        .getCalls()
        .filter(({ args }) =>
          /FROM `(?:unit|issuance|project_methodology)`/.test(args[0]),
        );
      expect(entityQueries).to.have.length(4);
      const lookupSql = queries
        .getCalls()
        .map(({ args }) => args[0])
        .filter((sql) => /FROM `(?:issuance|project_methodology)`/.test(sql));
      expect(lookupSql.join('\n')).to.not.include(
        other.issuance.cadTrustIssuanceId,
      );
      expect(lookupSql.join('\n')).to.not.include('project_name');
    } finally {
      issuanceQueries.restore();
      methodologyQueries.restore();
      queries.restore();
    }
  });

  it('preserves issuance org filtering through verification while enriching via methodology', async function () {
    const other = await createV2TestProgramChain({
      testId: 'FOREIGN',
      projectOverrides: { orgUid: 'foreign-org' },
    });
    await chain.issuance.update({
      cadTrustVerificationId: other.verification.cadTrustVerificationId,
    });
    const response = await list('issuance', { orgUid: 'foreign-org' });
    expect(response.body.data).to.have.length(2);
    expect(
      response.body.data.find(
        (row) => row.cadTrustIssuanceId === chain.issuance.cadTrustIssuanceId,
      ).cadTrustProjectId,
    ).to.equal(chain.project.cadTrustProjectId);
    const excluded = await list('issuance', { orgUid: unit.orgUid });
    expect(excluded.body.data).to.deep.equal([]);
  });

  it('avoids relationship lookups for empty pages and omitted unit enrichment', async function () {
    const lookup = sinon.spy(ProjectMethodologyV2, 'findAll');
    try {
      for (const table of ['unit', 'issuance']) {
        const response = await list(table, { page: 99 });
        expect(response.body.data).to.deep.equal([]);
        expect(response.body.pageCount).to.equal(1);
      }
      const response = await list('unit', { search: 'Nomatchingresponseunit' });
      expect(response.body.data).to.deep.equal([]);
      await list('unit', { columns: 'unitSerialId' });
      expect(lookup.callCount).to.equal(0);
    } finally {
      lookup.restore();
    }
  });
});
