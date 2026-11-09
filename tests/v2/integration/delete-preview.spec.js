import scheduler from '../../../src/tasks/index.js';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { createDeletePreview } from '../../../src/utils/v2-delete-preview.js';
import { DeletePreviewTokenStore } from '../../../src/utils/v2-delete-preview-tokens.js';
import { READ_ONLY_ERROR } from '../../../src/utils/read-only-response.js';
import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import {
  StagingV2,
  ProjectV2,
  UnitV2,
  UnitLabelV2,
  VerificationV2,
  OrganizationsV2,
  AefT5AuthorizedEntitiesV2,
} from '../../../src/models/v2/index.js';
import {
  createV2TestHomeOrg,
  pauseSchedulerTasks,
  resumeSchedulerTasks,
  withConfigOverride,
} from '../utils/v2-test-helpers.js';
import {
  cascadeModels,
  createCascadeFixture,
} from '../utils/cascade-delete-fixture.js';

const keys = (members) =>
  members.map(({ table, id }) => `${table}:${id}`).sort();
const snapshot = () =>
  Promise.all(
    cascadeModels.map((model) =>
      model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }),
    ),
  );

describe('CAR-229 delete preview', function () {
  this.timeout(30000);
  let fixture;
  let schedulerStart;
  before(async function () {
    // Startup registers jobs after a delayed call to scheduler.start. Pausing
    // current jobs alone does not prevent that later registration. Keep this
    // unrelated background boundary inactive while exercising API snapshots.
    schedulerStart = sinon.stub(scheduler, 'start').resolves();
    await prepareV2Db();
    await pauseSchedulerTasks();
    await createV2TestHomeOrg();
  });
  after(async function () {
    schedulerStart.restore();
    await resumeSchedulerTasks();
  });
  beforeEach(async function () {
    await StagingV2.destroy({ where: {} });
    for (const model of cascadeModels) await model.destroy({ where: {} });
    fixture = await createCascadeFixture();
  });
  for (const table of ['project', 'verification', 'issuance', 'unit']) {
    it(`returns exact complete ${table} membership without writes or notifications`, async function () {
      const expected = fixture.expected[table];
      const before = await snapshot();
      const events = [];
      const subscription = StagingV2.changes.subscribe((event) =>
        events.push(event),
      );
      let response;
      try {
        response = await supertest(app)
          .get(`/v2/${table}/${expected[0].id}/delete-preview`)
          .expect(200);
      } finally {
        subscription.unsubscribe();
      }
      expect(keys(response.body.affectedRecords)).to.deep.equal(keys(expected));
      expect(response.body.target).to.deep.equal({ table, id: expected[0].id });
      expect(response.body.confirmationRequired).to.equal(true);
      expect(response.body.totalRecords).to.equal(expected.length);
      const childCounts = {};
      for (const child of expected.slice(1))
        childCounts[child.table] = (childCounts[child.table] || 0) + 1;
      expect(response.body.childCounts).to.deep.equal(childCounts);
      expect(response.body.confirmationToken).to.match(/^[A-Za-z0-9_-]{43}$/);
      expect(Date.parse(response.body.expiresAt)).to.be.greaterThan(Date.now());
      expect(response.headers['cache-control']).to.equal('no-store');
      expect(await StagingV2.count()).to.equal(0);
      expect(await snapshot()).to.deep.equal(before);
      expect(events).to.deep.equal([]);
    });
  }

  const stage = (table, records, values = {}) =>
    StagingV2.create({
      uuid: uuidv4(),
      table,
      action: 'INSERT',
      data: typeof records === 'string' ? records : JSON.stringify(records),
      committed: false,
      failed_commit: false,
      is_transfer: false,
      ...values,
    });
  const preview = (table = 'project') =>
    supertest(app).get(
      `/v2/${table}/${fixture.expected[table][0].id}/delete-preview`,
    );
  const assertConflict = async (response) => {
    expect(response.status).to.equal(409);
    expect(response.body.code).to.equal('DELETE_PREVIEW_STAGING_CONFLICT');
    expect(response.body).not.to.have.property('confirmationToken');
  };
  for (const table of ['project', 'verification', 'issuance', 'unit']) {
    it(`previews a zero-child ${table} without staging it`, async function () {
      const [root, ...children] = fixture.expected[table];
      for (const child of [...children].reverse()) {
        const model = cascadeModels.find(
          (item) => item.tableName === child.table,
        );
        await model.destroy({
          where: { [model.primaryKeyAttribute]: child.id },
        });
      }
      const response = await preview(table).expect(200);
      expect(response.body.confirmationRequired).to.equal(false);
      expect(response.body.affectedRecords).to.deep.equal([
        { table, id: root.id },
      ]);
      expect(response.body.childCounts).to.deep.equal({});
      expect(response.body.totalRecords).to.equal(1);
      expect(await StagingV2.count()).to.equal(0);
    });
    it(`returns 404 for a missing ${table}`, async function () {
      const response = await supertest(app)
        .get(`/v2/${table}/${uuidv4()}/delete-preview`)
        .expect(404);
      expect(response.body.code).to.equal('DELETE_PREVIEW_NOT_FOUND');
      expect(response.body).not.to.have.property('confirmationToken');
    });
  }
  it('applies write eligibility in read-only mode while ordinary reads remain usable', async function () {
    await withConfigOverride(
      async () => {
        const response = await preview().expect(403);
        expect(response.body).to.deep.equal(READ_ONLY_ERROR);
        await supertest(app)
          .get(`/v2/project/${fixture.records.aProject.id}`)
          .expect(200);
      },
      { APP: { READ_ONLY: true } },
    );
  });
  it('preserves the pending non-transfer commit blocker even for unrelated work', async function () {
    await stage('label', [{ cad_trust_label_id: uuidv4() }], {
      committed: true,
    });
    const response = await preview().expect(400);
    expect(response.body.error).to.include('pending commit(s)');
    expect(response.body).not.to.have.property('confirmationToken');
  });
  it('preserves missing/unsubscribed home organization eligibility', async function () {
    const home = await OrganizationsV2.findOne({ where: { is_home: true } });
    try {
      await OrganizationsV2.update(
        { subscribed: false },
        { where: { org_uid: home.org_uid } },
      );
      expect((await preview().expect(400)).body.error).to.include(
        'still confirming',
      );
      await OrganizationsV2.update(
        { is_home: false },
        { where: { org_uid: home.org_uid } },
      );
      expect((await preview().expect(400)).body.error).to.include(
        'No Home organization',
      );
    } finally {
      await OrganizationsV2.update(
        { is_home: true, subscribed: true },
        { where: { org_uid: home.org_uid } },
      );
    }
  });
  for (const member of ['root', 'descendant']) {
    it(`checks ${member} ownership before minting`, async function () {
      const model = member === 'root' ? ProjectV2 : UnitV2;
      const id =
        member === 'root'
          ? fixture.records.aProject.id
          : fixture.records.aV1I1U1.id;
      await model.update(
        { orgUid: 'other-owner' },
        { where: { [model.primaryKeyAttribute]: id } },
      );
      const store = new DeletePreviewTokenStore();
      let error;
      try {
        await createDeletePreview('project', fixture.records.aProject.id, {
          tokenStore: store,
        });
      } catch (caught) {
        error = caught;
      }
      expect(error?.message).to.include('Restricted data');
      expect(store.size).to.equal(0);
      expect(await StagingV2.count()).to.equal(0);
    });
  }
  it('preserves project reference blockers', async function () {
    await ProjectV2.update(
      { cadTrustReferenceProjectId: fixture.records.aProject.id },
      { where: { cadTrustProjectId: fixture.records.bProject.id } },
    );
    const response = await preview().expect(409);
    expect(response.body.code).to.equal('DELETE_PREVIEW_REFERENCED');
    expect(response.body.references).to.deep.include({
      table: 'project',
      count: 1,
      label: 'projects referencing this project',
    });
  });
  for (const table of ['unit', 'project']) {
    it(`preserves ${table} AEF unit reference blockers`, async function () {
      await AefT5AuthorizedEntitiesV2.create({
        cadTrustUnitId: fixture.records.aV1I1U1.id,
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-01',
        aefT5AuthorizedEntitiesName: 'Test',
        aefT5AuthorizedEntitiesId: 'test',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'test',
      });
      try {
        const response = await preview(table).expect(409);
        expect(response.body.code).to.equal('DELETE_PREVIEW_REFERENCED');
      } finally {
        await AefT5AuthorizedEntitiesV2.destroy({ where: {} });
      }
    });
  }
  for (const [name, action, flags] of [
    ['active insert', 'INSERT', {}],
    ['active update', 'UPDATE', {}],
    ['overlapping delete', 'DELETE', {}],
    [
      'failed retryable update',
      'UPDATE',
      { committed: true, failed_commit: true },
    ],
    ['transfer', 'UPDATE', { committed: true, is_transfer: true }],
  ]) {
    it(`rejects ${name} overlaps without changing staging`, async function () {
      await stage('unit', [{ cad_trust_unit_id: fixture.records.aV1I1U1.id }], {
        action,
        ...flags,
      });
      const before = await StagingV2.findAll({ raw: true });
      await assertConflict(await preview());
      expect(await StagingV2.findAll({ raw: true })).to.deep.equal(before);
    });
  }
  for (const camel of [false, true]) {
    it(`examines every ${camel ? 'camel' : 'snake'} payload array member and staged-only child`, async function () {
      await stage('unit_label', [
        {
          [camel ? 'cadTrustUnitLabelId' : 'cad_trust_unit_label_id']: uuidv4(),
          [camel ? 'cadTrustUnitId' : 'cad_trust_unit_id']:
            fixture.records.bV1I1U1.id,
        },
        {
          [camel ? 'cadTrustUnitLabelId' : 'cad_trust_unit_label_id']: uuidv4(),
          [camel ? 'cadTrustUnitId' : 'cad_trust_unit_id']:
            fixture.records.aV1I1U1.id,
        },
      ]);
      await assertConflict(await preview('unit'));
    });
  }
  for (const direction of ['into', 'out of']) {
    it(`rejects updates reparenting ${direction} the graph`, async function () {
      await stage(
        'unit',
        [
          {
            cad_trust_unit_id:
              fixture.records[direction === 'into' ? 'bV1I1U1' : 'aV1I1U1'].id,
            cad_trust_issuance_id:
              fixture.records[direction === 'into' ? 'aV1I1' : 'bV1I1'].id,
          },
        ],
        { action: 'UPDATE' },
      );
      await assertConflict(await preview('issuance'));
    });
  }
  for (const malformed of ['{invalid', 'null', '[null]', '[]', '{}', '[{}]']) {
    it(`rejects malformed relevant staging ${malformed}`, async function () {
      await stage('unit_label', malformed);
      await assertConflict(await preview('unit'));
    });
  }
  it('allows unrelated staged work, failed and transfer rows, and malformed unrelated tables', async function () {
    await stage('unit', [{ cad_trust_unit_id: fixture.records.bV1I1U1.id }], {
      action: 'UPDATE',
      failed_commit: true,
    });
    await stage('unit', [{ cad_trust_unit_id: fixture.records.bV1I1U1.id }], {
      action: 'UPDATE',
      is_transfer: true,
      committed: true,
    });
    await stage('label', '{invalid');
    const before = await StagingV2.findAll({ raw: true });
    await preview().expect(200);
    expect(await StagingV2.findAll({ raw: true })).to.deep.equal(before);
  });
  it('rejects malformed staging in an empty descendant table instead of omitting possible new children', async function () {
    await UnitLabelV2.destroy({ where: {} });
    await stage('unit_label', '{invalid');
    await assertConflict(await preview('unit'));
  });
  it('supports browser custom-header preflight without changing CORS', async function () {
    const response = await supertest(app)
      .options(`/v2/unit/${fixture.records.aV1I1U1.id}`)
      .set('Origin', 'https://example.test')
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'X-Deletion-Confirmation')
      .expect(204);
    expect(
      response.headers['access-control-allow-headers'].toLowerCase(),
    ).to.include('x-deletion-confirmation');
  });
  it('requires a current preview token for cascading DELETE instead of ignoring the header', async function () {
    const unknown = await supertest(app)
      .delete(`/v2/unit/${fixture.records.aV1I1U1.id}`)
      .set('X-Deletion-Confirmation', 'unknown')
      .expect(409);
    expect(unknown.body.code).to.equal('DELETE_PREVIEW_UNKNOWN');
    const missing = await supertest(app)
      .delete(`/v2/unit/${fixture.records.aV1I1U1.id}`)
      .expect(409);
    expect(missing.body.code).to.equal('DELETE_CONFIRMATION_REQUIRED');
    expect(await StagingV2.count()).to.equal(0);
  });
  const fingerprint = async (table = 'unit') => {
    const store = new DeletePreviewTokenStore();
    const response = await createDeletePreview(
      table,
      fixture.expected[table][0].id,
      { tokenStore: store },
    );
    const home = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });
    return store.lookup(response.confirmationToken, {
      table,
      id: response.target.id,
      orgUid: home.org_uid,
      registryId: home.registry_id,
    }).fingerprint;
  };
  it('fingerprints exact child identities, detecting same-count replacement', async function () {
    const before = await fingerprint();
    const label = await UnitLabelV2.findByPk(fixture.records.aV1I1U1Label.id, {
      raw: true,
    });
    await UnitLabelV2.destroy({
      where: { cadTrustUnitLabelId: label.cadTrustUnitLabelId },
    });
    await UnitLabelV2.create({ ...label, cadTrustUnitLabelId: uuidv4() });
    expect(await fingerprint()).not.to.equal(before);
  });
  it('fingerprints semantic record and relationship changes', async function () {
    const before = await fingerprint();
    await UnitV2.update(
      { unitSerialId: 'changed' },
      { where: { cadTrustUnitId: fixture.records.aV1I1U1.id } },
    );
    const semantic = await fingerprint();
    expect(semantic).not.to.equal(before);
    await UnitV2.update(
      { cadTrustIssuanceId: fixture.records.aV1I2.id },
      { where: { cadTrustUnitId: fixture.records.aV1I1U1.id } },
    );
    expect(await fingerprint()).not.to.equal(semantic);
  });
  it('excludes volatile timestamps and unrelated graph writes from the fingerprint', async function () {
    const before = await fingerprint();
    await UnitV2.update(
      { updatedAt: new Date('2030-01-01'), createdAt: new Date('2020-01-01') },
      { where: { cadTrustUnitId: fixture.records.aV1I1U1.id }, silent: true },
    );
    await ProjectV2.update(
      { projectName: 'unrelated changed' },
      { where: { cadTrustProjectId: fixture.records.bProject.id } },
    );
    expect(await fingerprint()).to.equal(before);
  });
  for (const limits of [{ maxRecords: 1 }, { maxResponseBytes: 1 }]) {
    it(`checks complete response limits before admitting tokens ${JSON.stringify(limits)}`, async function () {
      const store = new DeletePreviewTokenStore();
      let error;
      try {
        await createDeletePreview('project', fixture.records.aProject.id, {
          ...limits,
          tokenStore: store,
        });
      } catch (caught) {
        error = caught;
      }
      expect(error?.code).to.equal('DELETE_PREVIEW_TOO_LARGE');
      expect(store.size).to.equal(0);
      expect(await StagingV2.count()).to.equal(0);
    });
  }
  it('includes token and expiry metadata in the exact complete-response byte cap', async function () {
    const store = new DeletePreviewTokenStore();
    const response = await createDeletePreview(
      'unit',
      fixture.records.aV1I1U1.id,
      { tokenStore: store },
    );
    const bytes = Buffer.byteLength(JSON.stringify(response));
    let error;
    try {
      await createDeletePreview('unit', fixture.records.aV1I1U1.id, {
        tokenStore: store,
        maxResponseBytes: bytes - 1,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).to.equal('DELETE_PREVIEW_TOO_LARGE');
    expect(store.size).to.equal(1);
    await createDeletePreview('unit', fixture.records.aV1I1U1.id, {
      tokenStore: store,
      maxResponseBytes: bytes,
    });
    expect(store.size).to.equal(2);
  });
  it('uses a single DEFERRED snapshot for every eligibility, ownership, graph and staging read', async function () {
    const models = [
      ...Object.values(StagingV2.getMutationGuardModelMap()),
      StagingV2,
      OrganizationsV2,
    ];
    const seen = [];
    const record = (options) => seen.push(options.transaction);
    for (const model of models) {
      model.addHook('beforeFind', 'car229-preview-tx', record);
      model.addHook('beforeCount', 'car229-preview-tx', record);
    }
    try {
      // Middleware retains its independent readiness reads; these hooks cover
      // the service's complete snapshot, below that unchanged boundary.
      await createDeletePreview('project', fixture.records.aProject.id);
    } finally {
      for (const model of models) {
        model.removeHook('beforeFind', 'car229-preview-tx');
        model.removeHook('beforeCount', 'car229-preview-tx');
      }
    }
    expect(seen.length).to.be.greaterThan(50);
    expect(seen[0]).to.exist;
    expect(seen.every((transaction) => transaction === seen[0])).to.equal(true);
    expect(seen[0].options.type).to.equal(Transaction.TYPES.DEFERRED);
    expect(seen[0].finished).to.equal('commit');
  });
  it('keeps membership, ownership and staging eligibility coherent during a real competing commit', async function () {
    let reached = false;
    let reader;
    let writer;
    VerificationV2.addHook(
      'afterFind',
      'car229-preview-interleave',
      async (_records, options) => {
        if (reached) return;
        reached = true;
        reader = options.transaction;
        await sequelizeV2.transaction(async (transaction) => {
          writer = transaction;
          await UnitLabelV2.create(
            {
              cadTrustUnitLabelId: uuidv4(),
              cadTrustUnitId: fixture.records.aV1I1U1.id,
              cadTrustLabelId: fixture.records.label.id,
            },
            { transaction },
          );
          await UnitV2.update(
            { orgUid: 'changed-owner' },
            {
              where: { cadTrustUnitId: fixture.records.aV1I1U1.id },
              transaction,
            },
          );
          await StagingV2.create(
            {
              uuid: uuidv4(),
              table: 'unit_label',
              action: 'INSERT',
              data: JSON.stringify([
                {
                  cad_trust_unit_label_id: uuidv4(),
                  cad_trust_unit_id: fixture.records.aV1I1U1.id,
                },
              ]),
              committed: false,
              failed_commit: false,
              is_transfer: false,
            },
            { transaction },
          );
        });
      },
    );
    let response;
    try {
      response = await preview().expect(200);
    } finally {
      VerificationV2.removeHook('afterFind', 'car229-preview-interleave');
    }
    expect(reached).to.equal(true);
    expect(reader.connection).not.to.equal(writer.connection);
    expect(writer.finished).to.equal('commit');
    expect(reader.finished).to.equal('commit');
    expect(keys(response.body.affectedRecords)).to.deep.equal(
      keys(fixture.expected.project),
    );
    const current = await preview().expect(400);
    expect(current.body.error).to.include('Restricted data');
    await UnitV2.update(
      { orgUid: 'test-home-org-v2' },
      { where: { cadTrustUnitId: fixture.records.aV1I1U1.id } },
    );
    await assertConflict(await preview());
  });

  for (const camel of [false, true]) {
    it(`blocks ${camel ? 'camel' : 'snake'} staged project reference relationships`, async function () {
      await stage('project', [
        {
          [camel ? 'cadTrustProjectId' : 'cad_trust_project_id']:
            fixture.records.bProject.id,
          [camel
            ? 'cadTrustReferenceProjectId'
            : 'cad_trust_reference_project_id']: fixture.records.aProject.id,
        },
      ]);
      const response = await preview().expect(409);
      expect(response.body.code).to.equal(
        camel ? 'DELETE_PREVIEW_STAGING_CONFLICT' : 'DELETE_PREVIEW_REFERENCED',
      );
    });
  }
  it('preserves the existing committed project self-reference exclusion', async function () {
    await ProjectV2.update(
      { cadTrustReferenceProjectId: fixture.records.aProject.id },
      { where: { cadTrustProjectId: fixture.records.aProject.id } },
    );
    await preview().expect(200);
  });

  it('does not allocate a token when snapshot completion fails', async function () {
    const store = new DeletePreviewTokenStore();
    const failure = new Error(
      'CAR229 injected read transaction completion failure',
    );
    const commit = sinon.stub(Transaction.prototype, 'commit').rejects(failure);
    let error;
    try {
      await createDeletePreview('unit', fixture.records.aV1I1U1.id, {
        tokenStore: store,
      });
    } catch (caught) {
      error = caught;
    } finally {
      commit.restore();
    }
    expect(error).to.equal(failure);
    expect(store.size).to.equal(0);
    expect(await StagingV2.count()).to.equal(0);
    // A fresh successful read proves the failed transaction released its connection.
    await createDeletePreview('unit', fixture.records.aV1I1U1.id, {
      tokenStore: store,
    });
    expect(store.size).to.equal(1);
  });
  it('reports bounded-cache exhaustion without changing data or evicting a preview', async function () {
    const store = new DeletePreviewTokenStore({ maxEntries: 1 });
    const response = await createDeletePreview(
      'unit',
      fixture.records.aV1I1U1.id,
      { tokenStore: store },
    );
    let error;
    try {
      await createDeletePreview('unit', fixture.records.aV1I1U1.id, {
        tokenStore: store,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).to.equal('DELETE_PREVIEW_CAPACITY');
    expect(error.status).to.equal(503);
    const home = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });
    expect(
      store.lookup(response.confirmationToken, {
        table: 'unit',
        id: fixture.records.aV1I1U1.id,
        orgUid: home.org_uid,
        registryId: home.registry_id,
      }),
    ).to.exist;
    expect(store.size).to.equal(1);
    expect(await StagingV2.count()).to.equal(0);
  });
  for (const invalidParent of [null, 42, ['not-a-scalar']]) {
    it(`fails closed on malformed relevant relationship ${JSON.stringify(invalidParent)}`, async function () {
      await stage('unit_label', [
        { cad_trust_unit_label_id: uuidv4(), cad_trust_unit_id: invalidParent },
      ]);
      await assertConflict(await preview('unit'));
    });
  }
  it('fails closed on a staged-only child missing its required parent relationship', async function () {
    await stage('unit_label', [{ cad_trust_unit_label_id: uuidv4() }]);
    await assertConflict(await preview('unit'));
  });
});
