import { expect } from 'chai';
import sinon from 'sinon';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../../src/server.js';
import scheduler from '../../../src/tasks/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { LabelV2, UnitV2, UnitLabelV2 } from '../../../src/models/v2/index.js';
import {
  createV2TestHomeOrg,
  createV2TestProgramChain,
  getV2HomeOrgId,
  pauseSchedulerTasks,
  resumeSchedulerTasks,
} from '../utils/v2-test-helpers.js';

describe('V2 unit-label list filters', function () {
  this.timeout(30000);
  const foreignOrg = 'unit-label-filter-foreign-org';
  const units = {};
  const labels = {};
  const links = {};
  let chain;
  let homeOrg;
  let schedulerStart;

  const list = (query = {}) =>
    supertest(app)
      .get('/v2/unit-label')
      .query({ page: 1, limit: 100, ...query });
  const ids = (response) =>
    response.body.data.map((record) => record.cadTrustUnitLabelId);

  before(async function () {
    // Keep delayed startup and sync jobs outside these committed-record reads.
    schedulerStart = sinon.stub(scheduler, 'start').resolves();
    await prepareV2Db();
    await pauseSchedulerTasks();
    await createV2TestHomeOrg();
    homeOrg = await getV2HomeOrgId();
    chain = await createV2TestProgramChain({ testId: 'unit-label-filters' });
    await UnitLabelV2.destroy({ where: {} });

    for (const name of ['a', 'b', 'c']) {
      const unit = await UnitV2.create({
        cadTrustUnitId: uuidv4(),
        orgUid: name === 'b' ? foreignOrg : homeOrg,
        cadTrustIssuanceId: chain.issuance.cadTrustIssuanceId,
        unitSerialId: `unit-label-filter-${name}`,
        unitStartBlock: '1',
        unitEndBlock: '10',
        unitVintageYear: 2024,
      });
      units[name] = unit.cadTrustUnitId;
    }
    for (const name of ['x', 'y', 'z']) {
      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: `Unit-label filter ${name}`,
      });
      labels[name] = label.cadTrustLabelId;
    }
    const relationships = [
      ['ax', 'a', 'x', homeOrg],
      ['ay', 'a', 'y', foreignOrg],
      ['az', 'a', 'z', homeOrg],
      ['bx', 'b', 'x', homeOrg],
      ['by', 'b', 'y', foreignOrg],
      ['cx', 'c', 'x', foreignOrg],
    ];
    for (const [
      index,
      [name, unit, label, creator],
    ] of relationships.entries()) {
      const link = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: units[unit],
        cadTrustLabelId: labels[label],
        createdByOrgUid: creator,
        created_at: new Date(Date.UTC(2024, 0, index + 1)),
      });
      links[name] = link.cadTrustUnitLabelId;
    }
  });

  after(async function () {
    try {
      await UnitLabelV2.destroy({
        where: { cadTrustUnitLabelId: Object.values(links) },
      });
      await UnitV2.destroy({ where: { cadTrustUnitId: Object.values(units) } });
      await LabelV2.destroy({
        where: { cadTrustLabelId: Object.values(labels) },
      });
      if (chain) {
        for (const record of Object.values(chain).reverse())
          await record.destroy();
      }
    } finally {
      schedulerStart.restore();
      await resumeSchedulerTasks();
    }
  });

  it('preserves the unfiltered response and descending creation order', async function () {
    const response = await list().expect(200);
    expect(response.body.page).to.equal(1);
    expect(response.body.pageCount).to.equal(1);
    expect(ids(response)).to.deep.equal([
      links.cx,
      links.by,
      links.bx,
      links.az,
      links.ay,
      links.ax,
    ]);
  });

  it('selects all labels for one unit', async function () {
    const response = await list({ cadTrustUnitId: units.a }).expect(200);
    expect(ids(response)).to.deep.equal([links.az, links.ay, links.ax]);
  });

  it('selects all units for one label', async function () {
    const response = await list({ cadTrustLabelId: labels.x }).expect(200);
    expect(ids(response)).to.deep.equal([links.cx, links.bx, links.ax]);
  });

  it('intersects unit and label filters', async function () {
    const response = await list({
      cadTrustUnitId: units.a,
      cadTrustLabelId: labels.x,
    }).expect(200);
    expect(ids(response)).to.deep.equal([links.ax]);
  });

  it('returns no relationships for an existing unit and label without a link', async function () {
    const response = await list({
      cadTrustUnitId: units.b,
      cadTrustLabelId: labels.z,
    }).expect(200);
    expect(response.body).to.deep.equal({ page: 1, pageCount: 0, data: [] });
  });

  for (const field of ['cadTrustUnitId', 'cadTrustLabelId']) {
    it(`returns an empty page for a valid nonmatching ${field}`, async function () {
      const response = await list({ [field]: uuidv4() }).expect(200);
      expect(response.body).to.deep.equal({ page: 1, pageCount: 0, data: [] });
    });

    it(`paginates the filtered count and ordered results for ${field}`, async function () {
      const query = {
        [field]: field === 'cadTrustUnitId' ? units.a : labels.x,
        limit: 2,
      };
      const expected =
        field === 'cadTrustUnitId'
          ? [links.az, links.ay, links.ax]
          : [links.cx, links.bx, links.ax];
      for (const page of [1, 2, 3]) {
        const response = await list({ ...query, page }).expect(200);
        expect(response.body.page).to.equal(page);
        expect(response.body.pageCount).to.equal(2);
        expect(ids(response)).to.deep.equal(
          expected.slice((page - 1) * 2, page * 2),
        );
      }
    });

    it(`rejects an invalid UUID for ${field}`, async function () {
      const response = await list({ [field]: 'invalid-uuid' }).expect(400);
      expect(response.body.errors).to.deep.equal([
        `"${field}" must be a valid GUID`,
      ]);
    });

    it(`rejects repeated ${field} query values`, async function () {
      await list({ [field]: [uuidv4(), uuidv4()] }).expect(400);
    });

    it(`rejects an object-shaped ${field} query`, async function () {
      await list({ [`${field}[value]`]: uuidv4() }).expect(400);
    });
  }

  it('preserves organization and creator filters without relationship filters', async function () {
    const response = await list({ orgUid: 'me', createdByOrgUid: 'me' }).expect(
      200,
    );
    expect(ids(response)).to.deep.equal([links.az, links.ax]);
  });

  it('intersects label, owning unit organization and creator filters, including me', async function () {
    const owner = await list({
      cadTrustLabelId: labels.x,
      orgUid: 'me',
    }).expect(200);
    expect(ids(owner)).to.deep.equal([links.cx, links.ax]);
    const creator = await list({
      cadTrustLabelId: labels.x,
      createdByOrgUid: 'me',
    }).expect(200);
    expect(ids(creator)).to.deep.equal([links.bx, links.ax]);
    const both = await list({
      cadTrustLabelId: labels.x,
      orgUid: 'me',
      createdByOrgUid: 'me',
      limit: 1,
    }).expect(200);
    expect(ids(both)).to.deep.equal([links.ax]);
    expect(both.body.pageCount).to.equal(1);
  });

  it('intersects both relationship IDs with explicit organization and creator values', async function () {
    const response = await list({
      cadTrustUnitId: units.b,
      cadTrustLabelId: labels.y,
      orgUid: foreignOrg,
      createdByOrgUid: foreignOrg,
    }).expect(200);
    expect(ids(response)).to.deep.equal([links.by]);
    const excluded = await list({
      cadTrustUnitId: units.a,
      orgUid: foreignOrg,
    }).expect(200);
    expect(excluded.body).to.deep.equal({ page: 1, pageCount: 0, data: [] });
  });
});
