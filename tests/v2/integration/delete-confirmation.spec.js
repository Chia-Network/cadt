import xlsx from 'node-xlsx';
import { requestDeleteWithPreview } from '../live-api/helpers/delete-confirmation.js';
import {
  initializePicklists,
  getRandomPicklistValue,
} from '../utils/v2-picklist-test-helpers.js';
import scheduler from '../../../src/tasks/index.js';
import sinon from 'sinon';
import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { createDeletePreview } from '../../../src/utils/v2-delete-preview.js';
import { confirmDelete } from '../../../src/utils/v2-delete-confirmation.js';
import { DeletePreviewTokenStore } from '../../../src/utils/v2-delete-preview-tokens.js';
import { processingSyncRegistriesTransactionMutexV2 as mutex } from '../../../src/utils/v2-mutex-utils.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import {
  StagingV2,
  OrganizationsV2,
  UnitV2,
  UnitLabelV2,
  ProjectV2,
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

// This suite adds enough real HTTP calls to exhaust the full suite's shared
// 1,000-request client budget. Use a separate client identity while retaining
// the real limiter; the scoped trusted proxy setting is restored in after().
const request = Object.fromEntries(
  ['get', 'post', 'put', 'delete'].map((method) => [
    method,
    (endpoint) =>
      supertest(app)[method](endpoint).set('X-Forwarded-For', '192.0.2.229'),
  ]),
);

const keys = (members) =>
  members.map(({ table, id }) => `${table}:${id}`).sort();
const stagedKeys = async () =>
  keys(
    (await StagingV2.findAll()).flatMap((row) =>
      JSON.parse(row.data).map((record) => ({
        table: row.table,
        id: Object.values(record)[0],
      })),
    ),
  );

describe('CAR-229 delete confirmation', function () {
  this.timeout(30000);
  let fixture;
  let schedulerStart;
  let trustProxy;
  before(async function () {
    trustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
    schedulerStart = sinon.stub(scheduler, 'start').resolves();
    await prepareV2Db();
    await pauseSchedulerTasks();
    await createV2TestHomeOrg();
    await initializePicklists();
  });
  after(async function () {
    app.set('trust proxy', trustProxy);
    schedulerStart.restore();
    await resumeSchedulerTasks();
  });
  beforeEach(async function () {
    await StagingV2.destroy({ where: {} });
    for (const model of cascadeModels) await model.destroy({ where: {} });
    fixture = await createCascadeFixture();
  });
  const path = (table) => `/v2/${table}/${fixture.expected[table][0].id}`;
  const preview = async (table) =>
    (await request.get(`${path(table)}/delete-preview`).expect(200)).body;
  for (const table of ['project', 'verification', 'issuance', 'unit']) {
    it(`requires confirmation for current ${table} children without staging`, async function () {
      const response = await request.delete(path(table)).expect(409);
      expect(response.body.code).to.equal('DELETE_CONFIRMATION_REQUIRED');
      expect(response.body.previewRoute).to.equal(
        `${path(table)}/delete-preview`,
      );
      expect(await StagingV2.count()).to.equal(0);
    });
    it(`confirms exact ${table} members once and explicitly replays the original result`, async function () {
      const { confirmationToken } = await preview(table);
      const guard = sinon.spy(StagingV2, 'assertMutationOwnedByHomeOrg');
      let response;
      try {
        response = await request
          .delete(path(table))
          .set('X-Deletion-Confirmation', confirmationToken)
          .expect(200);
      } finally {
        guard.restore();
      }
      expect(
        keys(
          guard.getCalls().map(({ args: [row] }) => ({
            table: row.table,
            id: Object.values(
              (Array.isArray(row.data) ? row.data : JSON.parse(row.data))[0],
            )[0],
          })),
        ),
      ).to.deep.equal(keys(fixture.expected[table]));
      expect(response.body.stagedChildDeletes).to.equal(
        fixture.expected[table].length - 1,
      );
      expect(await stagedKeys()).to.deep.equal(keys(fixture.expected[table]));
      const rows = await StagingV2.findAll({ raw: true });
      const replay = await request
        .delete(path(table))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(200);
      expect(replay.body).to.deep.equal({ ...response.body, replayed: true });
      expect(await StagingV2.findAll({ raw: true })).to.deep.equal(rows);
    });
    it(`rejects invalid tokens for zero-child ${table} rather than falling through`, async function () {
      for (const child of fixture.expected[table].slice(1).reverse()) {
        const model = cascadeModels.find(
          (item) => item.tableName === child.table,
        );
        await model.destroy({
          where: { [model.primaryKeyAttribute]: child.id },
        });
      }
      const response = await request
        .delete(path(table))
        .set('X-Deletion-Confirmation', 'unknown')
        .expect(409);
      expect(response.body.code).to.equal('DELETE_PREVIEW_UNKNOWN');
      expect(await StagingV2.count()).to.equal(0);
    });
  }
  const rejected = async (operation, code) => {
    let error;
    try {
      await operation;
    } catch (caught) {
      error = caught;
    }
    expect(error, 'expected rejection').to.exist;
    if (code) expect(error.code).to.equal(code);
    return error;
  };
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const localPreview = (tokenStore, table = 'unit') =>
    createDeletePreview(table, fixture.expected[table][0].id, { tokenStore });
  const localConfirm = (tokenStore, token, table = 'unit') =>
    confirmDelete(table, fixture.expected[table][0].id, token, { tokenStore });
  const stage = (table, records, flags = {}) =>
    StagingV2.create({
      uuid: uuidv4(),
      table,
      action: 'UPDATE',
      data: typeof records === 'string' ? records : JSON.stringify(records),
      committed: false,
      failed_commit: false,
      is_transfer: false,
      ...flags,
      ...(typeof records === 'string' && { action: 'INSERT' }),
    });
  it('rejects a token for another root type and target', async function () {
    const { confirmationToken } = await preview('project');
    for (const endpoint of [
      path('unit'),
      `/v2/project/${fixture.records.bProject.id}`,
    ]) {
      const response = await request
        .delete(endpoint)
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(409);
      expect(response.body.code).to.equal('DELETE_PREVIEW_MISMATCH');
    }
    expect(await StagingV2.count()).to.equal(0);
  });
  for (const field of ['org_uid', 'registry_id']) {
    it(`rechecks token ${field} binding before execution and replay`, async function () {
      const store = new DeletePreviewTokenStore();
      const { confirmationToken } = await localPreview(store);
      const home = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });
      await OrganizationsV2.update(
        { [field]: 'changed' },
        { where: { org_uid: home.org_uid } },
      );
      try {
        await rejected(
          localConfirm(store, confirmationToken),
          'DELETE_PREVIEW_MISMATCH',
        );
        expect(await StagingV2.count()).to.equal(0);
      } finally {
        await OrganizationsV2.update(
          { [field]: home[field] },
          { where: { is_home: true } },
        );
      }
      await localConfirm(store, confirmationToken);
      await OrganizationsV2.update(
        { [field]: 'changed' },
        { where: { org_uid: home.org_uid } },
      );
      try {
        await rejected(
          localConfirm(store, confirmationToken),
          'DELETE_PREVIEW_MISMATCH',
        );
      } finally {
        await OrganizationsV2.update(
          { [field]: home[field] },
          { where: { is_home: true } },
        );
      }
    });
  }
  it('checks expiry after waiting for the registry mutex without claiming or staging', async function () {
    let now = 0;
    const store = new DeletePreviewTokenStore({ clock: () => now, ttlMs: 10 });
    const { confirmationToken } = await localPreview(store);
    const release = await mutex.acquire();
    const acquire = sinon.spy(mutex, 'acquire');
    const request = localConfirm(store, confirmationToken);
    // assertV2IfReadOnlyMode yields once before acquire. Observe that boundary.
    await Promise.resolve();
    expect(acquire.calledOnce).to.equal(true);
    now = 10;
    release();
    try {
      await rejected(request, 'DELETE_PREVIEW_EXPIRED');
    } finally {
      acquire.restore();
    }
    expect(await StagingV2.count()).to.equal(0);
  });
  it('rejects restart-invalidated tokens and detects existing overlaps after a lost response plus restart', async function () {
    const store = new DeletePreviewTokenStore();
    const { confirmationToken } = await localPreview(store);
    await rejected(
      localConfirm(new DeletePreviewTokenStore(), confirmationToken),
      'DELETE_PREVIEW_UNKNOWN',
    );
    await localConfirm(store, confirmationToken);
    await rejected(
      localPreview(new DeletePreviewTokenStore()),
      'DELETE_PREVIEW_STAGING_CONFLICT',
    );
    expect(await stagedKeys()).to.deep.equal(keys(fixture.expected.unit));
  });
  for (const change of [
    'semantic root',
    'semantic child',
    'same-count replacement',
    'new child',
    'last child removed',
    'reparented child',
  ]) {
    it(`rejects changed exact plans: ${change}`, async function () {
      const { confirmationToken } = await preview('unit');
      const unit = fixture.records.aV1I1U1.id;
      const child = fixture.records.aV1I1U1Label.id;
      if (change === 'semantic root')
        await UnitV2.update(
          { unitSerialId: 'changed' },
          { where: { cadTrustUnitId: unit } },
        );
      if (change === 'semantic child')
        await UnitLabelV2.update(
          { labelUnitDescription: 'changed' },
          { where: { cadTrustUnitLabelId: child } },
        );
      if (['same-count replacement', 'last child removed'].includes(change))
        await UnitLabelV2.destroy({ where: { cadTrustUnitLabelId: child } });
      if (['same-count replacement', 'new child'].includes(change))
        await UnitLabelV2.create({
          cadTrustUnitLabelId: uuidv4(),
          cadTrustUnitId: unit,
          cadTrustLabelId: fixture.records.label.id,
        });
      if (change === 'reparented child')
        await UnitLabelV2.update(
          { cadTrustUnitId: fixture.records.bV1I1U1.id },
          { where: { cadTrustUnitLabelId: child } },
        );
      const response = await request
        .delete(path('unit'))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(409);
      expect(response.body.code).to.equal('DELETE_PREVIEW_CHANGED');
      expect(await StagingV2.count()).to.equal(0);
    });
  }
  it('requires a new preview when a first child appears after a zero-child preview', async function () {
    await UnitLabelV2.destroy({
      where: { cadTrustUnitId: fixture.records.aV1I1U1.id },
    });
    const { confirmationToken } = await preview('unit');
    await UnitLabelV2.create({
      cadTrustUnitLabelId: uuidv4(),
      cadTrustUnitId: fixture.records.aV1I1U1.id,
      cadTrustLabelId: fixture.records.label.id,
    });
    expect((await request.delete(path('unit')).expect(409)).body.code).to.equal(
      'DELETE_CONFIRMATION_REQUIRED',
    );
    expect(
      (
        await request
          .delete(path('unit'))
          .set('X-Deletion-Confirmation', confirmationToken)
          .expect(409)
      ).body.code,
    ).to.equal('DELETE_PREVIEW_CHANGED');
    expect(await StagingV2.count()).to.equal(0);
  });
  for (const owner of ['root', 'descendant']) {
    it(`rechecks ${owner} ownership after preview`, async function () {
      const { confirmationToken } = await preview('project');
      const model = owner === 'root' ? ProjectV2 : UnitV2;
      const id = fixture.records[owner === 'root' ? 'aProject' : 'aV1I1U1'].id;
      await model.update(
        { orgUid: 'other-owner' },
        { where: { [model.primaryKeyAttribute]: id } },
      );
      const response = await request
        .delete(path('project'))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(400);
      expect(response.body.error).to.include('Restricted data');
      expect(await StagingV2.count()).to.equal(0);
    });
  }
  it('rejects inherited root ownership changes outside the fingerprint at the staging guard', async function () {
    const { confirmationToken } = await preview('issuance');
    await ProjectV2.update(
      { orgUid: 'other-owner' },
      { where: { cadTrustProjectId: fixture.records.aProject.id } },
    );
    const rootWrite = sinon.spy(StagingV2, 'create');
    try {
      const response = await request
        .delete(path('issuance'))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(400);
      expect(response.body.error).to.include('Restricted data');
      // Reaching the root write proves the unchanged fingerprint matched and
      // child writes passed; the real inherited-owner guard rejects the root.
      expect(rootWrite.calledOnce).to.equal(true);
      expect(rootWrite.firstCall.args[0].table).to.equal('issuance');
    } finally {
      rootWrite.restore();
    }
    expect(await StagingV2.count()).to.equal(0);
  });
  it('keeps the canonical staging guard for an unauthorized descendant write', async function () {
    const { confirmationToken } = await preview('project');
    const id = fixture.records.aV1I1U1.id;
    const originalOwner = (await UnitV2.findByPk(id)).orgUid;
    const original = StagingV2.bulkCreate;
    // Mutate real data after fingerprint validation, then invoke the unchanged
    // staging implementation; authorization and the rollback remain real.
    const write = sinon
      .stub(StagingV2, 'bulkCreate')
      .callsFake(async (rows, options) => {
        await UnitV2.update(
          { orgUid: 'other-owner' },
          { where: { cadTrustUnitId: id }, transaction: options.transaction },
        );
        return original.call(StagingV2, rows, options);
      });
    try {
      const response = await request
        .delete(path('project'))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(400);
      expect(response.body.error).to.include('Restricted data');
      expect(write.calledOnce).to.equal(true);
    } finally {
      write.restore();
    }
    expect(await StagingV2.count()).to.equal(0);
    expect((await UnitV2.findByPk(id)).orgUid).to.equal(originalOwner);
  });
  for (const table of ['unit', 'project']) {
    it(`rechecks a new ${table} reference blocker`, async function () {
      const { confirmationToken } = await preview(table);
      await AefT5AuthorizedEntitiesV2.create({
        cadTrustUnitId: fixture.records.aV1I1U1.id,
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-01',
        aefT5AuthorizedEntitiesName: 'Test',
        aefT5AuthorizedEntitiesId: 'test',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'test',
      });
      try {
        const response = await request
          .delete(path(table))
          .set('X-Deletion-Confirmation', confirmationToken)
          .expect(409);
        expect(response.body.error).to.equal(
          'Referenced records must be removed before deletion',
        );
        expect(await StagingV2.count()).to.equal(0);
      } finally {
        await AefT5AuthorizedEntitiesV2.destroy({ where: {} });
      }
    });
  }
  for (const [name, records, flags] of [
    [
      'new child',
      (f) => [
        {
          cad_trust_unit_label_id: uuidv4(),
          cad_trust_unit_id: f.records.aV1I1U1.id,
        },
      ],
      { action: 'INSERT' },
    ],
    [
      'failed retry',
      (f) => [{ cad_trust_unit_label_id: f.records.aV1I1U1Label.id }],
      { committed: true, failed_commit: true },
    ],
    [
      'transfer',
      (f) => [{ cad_trust_unit_label_id: f.records.aV1I1U1Label.id }],
      { committed: true, is_transfer: true },
    ],
    [
      'multi-record',
      (f) => [
        { cad_trust_unit_label_id: f.records.bV1I1U1Label.id },
        { cad_trust_unit_label_id: f.records.aV1I1U1Label.id },
      ],
      {},
    ],
    [
      'camel reparent into',
      (f) => [
        {
          cadTrustUnitLabelId: f.records.bV1I1U1Label.id,
          cadTrustUnitId: f.records.aV1I1U1.id,
        },
      ],
      {},
    ],
    [
      'reparent out',
      (f) => [
        {
          cad_trust_unit_label_id: f.records.aV1I1U1Label.id,
          cad_trust_unit_id: f.records.bV1I1U1.id,
        },
      ],
      {},
    ],
    [
      'overlapping delete',
      (f) => [{ cad_trust_unit_label_id: f.records.aV1I1U1Label.id }],
      { action: 'DELETE' },
    ],
    ...['{invalid', 'null', '[null]', '[]', '{}', '[{}]'].map((value) => [
      `malformed ${value}`,
      () => value,
      {},
    ]),
  ]) {
    it(`rejects ${name} staged after the preview without partial writes`, async function () {
      const { confirmationToken } = await preview('unit');
      const conflicting = await stage('unit_label', records(fixture), flags);
      const before = await StagingV2.findAll({ raw: true });
      const response = await request
        .delete(path('unit'))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(409);
      expect(response.body.code).to.equal('DELETE_PREVIEW_STAGING_CONFLICT');
      expect(response.body.error).to.include(conflicting.uuid);
      expect(await StagingV2.findAll({ raw: true })).to.deep.equal(before);
    });
  }
  it('allows unrelated writes and excludes volatile timestamps from confirmation', async function () {
    const { confirmationToken } = await preview('unit');
    await stage('unit', [{ cad_trust_unit_id: fixture.records.bV1I1U1.id }], {
      failed_commit: true,
    });
    await stage('label', '{invalid');
    await UnitV2.update(
      { updatedAt: new Date('2030-01-01') },
      { where: { cadTrustUnitId: fixture.records.aV1I1U1.id }, silent: true },
    );
    await ProjectV2.update(
      { projectName: 'unrelated' },
      { where: { cadTrustProjectId: fixture.records.bProject.id } },
    );
    await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(200);
    expect(await StagingV2.count()).to.equal(4);
  });
  for (const failure of ['parent', 'child', 'commit']) {
    it(`rolls back ${failure} failure and releases the claim for a safe retry`, async function () {
      const store = new DeletePreviewTokenStore();
      const { confirmationToken } = await localPreview(store, 'project');
      const bytes = store.retainedBytes;
      const fault = new Error(`CAR229 injected ${failure} failure`);
      let reached = false;
      let stub;
      let failedTransaction;
      const hook = failure === 'parent' ? 'afterCreate' : 'afterBulkCreate';
      if (failure === 'commit') {
        stub = sinon
          .stub(sequelizeV2.getQueryInterface(), 'commitTransaction')
          .callsFake(async (transaction) => {
            failedTransaction = transaction;
            reached = true;
            throw fault;
          });
      } else {
        StagingV2.addHook(hook, 'car229-confirm-fault', () => {
          reached = true;
          throw fault;
        });
      }
      try {
        expect(
          await rejected(localConfirm(store, confirmationToken, 'project')),
        ).to.equal(fault);
      } finally {
        stub?.restore();
        StagingV2.removeHook(hook, 'car229-confirm-fault');
      }
      expect(reached).to.equal(true);
      if (failedTransaction)
        expect(sequelizeV2.connectionManager.connections).not.to.have.property(
          failedTransaction.id,
        );
      expect(await StagingV2.count()).to.equal(0);
      expect(store.retainedBytes).to.equal(bytes);
      await localConfirm(store, confirmationToken, 'project');
      expect(await stagedKeys()).to.deep.equal(keys(fixture.expected.project));
    });
  }
  it('serializes concurrent same-token execution once while replaying a lost response', async function () {
    const store = new DeletePreviewTokenStore();
    const { confirmationToken } = await localPreview(store, 'project');
    const reached = deferred();
    const resume = deferred();
    let calls = 0;
    StagingV2.addHook('afterBulkCreate', 'car229-confirm-pause', async () => {
      calls++;
      reached.resolve();
      await resume.promise;
    });
    const first = localConfirm(store, confirmationToken, 'project');
    await reached.promise;
    const second = localConfirm(store, confirmationToken, 'project');
    resume.resolve();
    let responses;
    try {
      responses = await Promise.all([first, second]);
    } finally {
      StagingV2.removeHook('afterBulkCreate', 'car229-confirm-pause');
    }
    expect(calls).to.equal(1);
    expect(responses[1]).to.deep.equal({ ...responses[0], replayed: true });
    expect(await stagedKeys()).to.deep.equal(keys(fixture.expected.project));
  });
  it('rejects a distinct concurrent overlapping token in the same staging snapshot', async function () {
    const store = new DeletePreviewTokenStore();
    const firstToken = (await localPreview(store, 'project')).confirmationToken;
    const secondToken = (await localPreview(store, 'unit')).confirmationToken;
    const responses = await Promise.allSettled([
      localConfirm(store, firstToken, 'project'),
      localConfirm(store, secondToken, 'unit'),
    ]);
    expect(responses[0].status).to.equal('fulfilled');
    expect(responses[1].status).to.equal('rejected');
    expect(responses[1].reason.code).to.equal(
      'DELETE_PREVIEW_STAGING_CONFLICT',
    );
    expect(await stagedKeys()).to.deep.equal(keys(fixture.expected.project));
  });
  it('reserves bounded receipt capacity before any staging write', async function () {
    const measure = new DeletePreviewTokenStore();
    await localPreview(measure);
    const store = new DeletePreviewTokenStore({
      maxBytes: measure.retainedBytes,
    });
    const { confirmationToken } = await localPreview(store);
    await rejected(
      localConfirm(store, confirmationToken),
      'DELETE_PREVIEW_CAPACITY',
    );
    expect(await StagingV2.count()).to.equal(0);
  });
  it('uses one IMMEDIATE transaction for every confirmation read and write', async function () {
    const store = new DeletePreviewTokenStore();
    const { confirmationToken } = await localPreview(store, 'project');
    const models = [
      ...Object.values(StagingV2.getMutationGuardModelMap()),
      StagingV2,
      OrganizationsV2,
    ];
    const seen = [];
    const capture = (options) => seen.push(options.transaction);
    for (const model of models) {
      model.addHook('beforeFind', 'car229-confirm-tx', capture);
      model.addHook('beforeCount', 'car229-confirm-tx', capture);
    }
    StagingV2.addHook('beforeCreate', 'car229-confirm-tx', (_row, options) =>
      capture(options),
    );
    StagingV2.addHook(
      'beforeBulkCreate',
      'car229-confirm-tx',
      (_rows, options) => capture(options),
    );
    try {
      await localConfirm(store, confirmationToken, 'project');
    } finally {
      for (const model of models) {
        model.removeHook('beforeFind', 'car229-confirm-tx');
        model.removeHook('beforeCount', 'car229-confirm-tx');
      }
      StagingV2.removeHook('beforeCreate', 'car229-confirm-tx');
      StagingV2.removeHook('beforeBulkCreate', 'car229-confirm-tx');
    }
    expect(seen.length).to.be.greaterThan(50);
    expect(seen.every((transaction) => transaction === seen[0])).to.equal(true);
    expect(seen[0].options.type).to.equal(Transaction.TYPES.IMMEDIATE);
    expect(seen[0].finished).to.equal('commit');
  });
  it('rejects a second zero-child token overlapping the first confirmation', async function () {
    await UnitLabelV2.destroy({
      where: { cadTrustUnitId: fixture.records.aV1I1U1.id },
    });
    const first = await preview('unit');
    const second = await preview('unit');
    await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', first.confirmationToken)
      .expect(200);
    const response = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', second.confirmationToken)
      .expect(409);
    expect(response.body.code).to.equal('DELETE_PREVIEW_STAGING_CONFLICT');
    expect(await StagingV2.count()).to.equal(1);
  });
  it('rejects a staged-only child with a supplied zero-child token', async function () {
    await UnitLabelV2.destroy({
      where: { cadTrustUnitId: fixture.records.aV1I1U1.id },
    });
    const { confirmationToken } = await preview('unit');
    await stage(
      'unit_label',
      [
        {
          cad_trust_unit_label_id: uuidv4(),
          cad_trust_unit_id: fixture.records.aV1I1U1.id,
        },
      ],
      { action: 'INSERT' },
    );
    const response = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(409);
    expect(response.body.code).to.equal('DELETE_PREVIEW_STAGING_CONFLICT');
    expect(await StagingV2.count()).to.equal(1);
  });
  it('rejects a missing reviewed root, while replay still succeeds after root removal', async function () {
    const store = new DeletePreviewTokenStore();
    const { confirmationToken } = await localPreview(store);
    const root = await UnitV2.findByPk(fixture.records.aV1I1U1.id, {
      raw: true,
    });
    await UnitV2.destroy({ where: { cadTrustUnitId: root.cadTrustUnitId } });
    await rejected(
      localConfirm(store, confirmationToken),
      'DELETE_PREVIEW_CHANGED',
    );
    expect(await StagingV2.count()).to.equal(0);
    await UnitV2.create(root);
    const original = await localConfirm(store, confirmationToken);
    await UnitV2.destroy({ where: { cadTrustUnitId: root.cadTrustUnitId } });
    await StagingV2.destroy({ where: {} });
    expect(await localConfirm(store, confirmationToken)).to.deep.equal({
      ...original,
      replayed: true,
    });
    expect(await StagingV2.count()).to.equal(0);
  });
  it('replays without restoring caller-edited or removed staging rows', async function () {
    const { confirmationToken } = await preview('unit');
    const response = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(200);
    const root = await StagingV2.findOne({ where: { table: 'unit' } });
    const child = await StagingV2.findOne({ where: { table: 'unit_label' } });
    await request
      .put('/v2/staging')
      .send({
        uuid: root.uuid,
        data: [{ cad_trust_unit_id: fixture.records.bV1I1U1.id }],
      })
      .expect(200);
    await request.delete('/v2/staging').send({ uuid: child.uuid }).expect(200);
    const changed = await StagingV2.findAll({ raw: true });
    expect(changed).to.have.length(1);
    expect(JSON.parse(changed[0].data)).to.deep.equal([
      { cad_trust_unit_id: fixture.records.bV1I1U1.id },
    ]);
    const replay = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(200);
    expect(replay.body).to.deep.equal({ ...response.body, replayed: true });
    expect(await StagingV2.findAll({ raw: true })).to.deep.equal(changed);
  });
  it('allows ordinary selective commit and replays before pending-commit and overlap checks', async function () {
    const { confirmationToken } = await preview('unit');
    const original = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(200);
    const root = await StagingV2.findOne({ where: { table: 'unit' } });
    const child = await StagingV2.findOne({ where: { table: 'unit_label' } });
    await request
      .post('/v2/staging/commit')
      .send({
        ids: [child.uuid],
        comment: 'CAR-229 selective commit',
        author: 'Test User',
      })
      .expect(200);
    expect((await StagingV2.findByPk(child.id)).committed).to.equal(true);
    expect((await StagingV2.findByPk(root.id)).committed).to.equal(false);
    const before = await StagingV2.findAll({ raw: true });
    const replay = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(200);
    expect(replay.body).to.deep.equal({ ...original.body, replayed: true });
    expect(await StagingV2.findAll({ raw: true })).to.deep.equal(before);
  });
  it('rechecks read-only mode and API authentication before returning a completed receipt', async function () {
    const { confirmationToken } = await preview('unit');
    await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(200);
    await withConfigOverride(
      async () => {
        await request
          .delete(path('unit'))
          .set('X-Deletion-Confirmation', confirmationToken)
          .expect(403);
      },
      { APP: { READ_ONLY: true } },
    );
    await withConfigOverride(
      async () => {
        await request
          .delete(path('unit'))
          .set('X-Deletion-Confirmation', confirmationToken)
          .expect(403);
        await request
          .delete(path('unit'))
          .set('X-Deletion-Confirmation', confirmationToken)
          .set('x-api-key', 'car229-test-key')
          .expect(200);
      },
      { V2: { CADT_API_KEY: 'car229-test-key' } },
    );
  });
  it('rechecks pending commits arising after preview before new execution', async function () {
    const { confirmationToken } = await preview('unit');
    await stage('label', [{ cad_trust_label_id: fixture.records.label.id }], {
      committed: true,
    });
    const response = await request
      .delete(path('unit'))
      .set('X-Deletion-Confirmation', confirmationToken)
      .expect(400);
    expect(response.body.error).to.include('pending commit(s)');
    expect(await StagingV2.count()).to.equal(1);
  });
  it('observes a real competing database writer before discovery and rejects its newly staged child', async function () {
    const store = new DeletePreviewTokenStore();
    const { confirmationToken } = await localPreview(store);
    const writer = await sequelizeV2.transaction({
      type: Transaction.TYPES.IMMEDIATE,
    });
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
      { transaction: writer },
    );
    const attempted = deferred();
    let reader;
    const queryInterface = sequelizeV2.getQueryInterface();
    const original = queryInterface.startTransaction.bind(queryInterface);
    const start = sinon
      .stub(queryInterface, 'startTransaction')
      .callsFake((transaction, options) => {
        reader = transaction;
        const pending = original(transaction, options);
        attempted.resolve();
        return pending;
      });
    const request = localConfirm(store, confirmationToken);
    await attempted.promise;
    expect(reader.connection).not.to.equal(writer.connection);
    await writer.commit();
    try {
      await rejected(request, 'DELETE_PREVIEW_STAGING_CONFLICT');
    } finally {
      start.restore();
    }
    expect(await StagingV2.count()).to.equal(1);
    await StagingV2.destroy({ where: {} });
    await localConfirm(store, confirmationToken);
    expect(await stagedKeys()).to.deep.equal(keys(fixture.expected.unit));
  });
  it('holds SQLite write intent throughout discovery against a real second-connection writer', async function () {
    const store = new DeletePreviewTokenStore();
    const { confirmationToken } = await localPreview(store);
    let reached = false;
    let writerError;
    let readerConnection;
    let writerConnection;
    UnitLabelV2.addHook(
      'afterFind',
      'car229-database-race',
      async (_records, options) => {
        if (reached) return;
        reached = true;
        readerConnection = options.transaction.connection;
        const writer = await sequelizeV2.transaction({
          type: Transaction.TYPES.DEFERRED,
        });
        writerConnection = writer.connection;
        try {
          await sequelizeV2.query('PRAGMA busy_timeout=0', {
            transaction: writer,
          });
          try {
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
              { transaction: writer, retry: { max: 0 } },
            );
          } catch (error) {
            writerError = error;
          }
        } finally {
          await writer.rollback();
        }
      },
    );
    try {
      await localConfirm(store, confirmationToken);
    } finally {
      UnitLabelV2.removeHook('afterFind', 'car229-database-race');
    }
    expect(reached).to.equal(true);
    expect(readerConnection).not.to.equal(writerConnection);
    expect(writerError?.original?.code).to.equal('SQLITE_BUSY');
    expect(await stagedKeys()).to.deep.equal(keys(fixture.expected.unit));
  });
  for (const format of ['REST', 'CSV', 'XLSX']) {
    it(`rejects the same relevant update staged through ${format} after preview`, async function () {
      const id = fixture.records.aProject.id;
      const complete = {
        projectLink: 'https://example.com/project',
        projectType: [getRandomPicklistValue('projectType')],
        projectStatus: getRandomPicklistValue('projectStatus'),
        projectStatusDate: '2024-01-01',
        projectUnitMetric: getRandomPicklistValue('projectUnitMetric'),
      };
      await ProjectV2.update(complete, { where: { cadTrustProjectId: id } });
      const { confirmationToken } = await preview('project');
      const values = {
        cadTrustProjectId: id,
        projectName: 'Changed staged name',
      };
      if (format === 'REST') {
        await request
          .put(`/v2/project/${id}`)
          .send({
            ...complete,
            projectRegistryName: 'Test',
            projectId: 'a',
            projectName: values.projectName,
            projectSector: ['Agriculture'],
            cadTrustProgramId: fixture.records.program.id,
          })
          .expect(200);
      } else if (format === 'CSV') {
        await request
          .post('/v2/project/batch')
          .attach(
            'csv',
            Buffer.from(
              `cadTrustProjectId,projectName\n${id},${values.projectName}`,
            ),
            'confirmation.csv',
          )
          .expect(200);
      } else {
        const buffer = xlsx.build([
          {
            name: 'projects',
            data: [Object.keys(values), Object.values(values)],
          },
        ]);
        await request
          .put('/v2/project/xlsx')
          .attach('xlsx', buffer, 'confirmation.xlsx')
          .expect(200);
      }
      const before = await StagingV2.findAll({ raw: true });
      expect(before).to.have.length(1);
      const response = await request
        .delete(path('project'))
        .set('X-Deletion-Confirmation', confirmationToken)
        .expect(409);
      expect(response.body.code).to.equal('DELETE_PREVIEW_STAGING_CONFLICT');
      expect(response.body.error).to.include(before[0].uuid);
      expect(await StagingV2.findAll({ raw: true })).to.deep.equal(before);
    });
  }
  for (const table of ['project', 'verification', 'issuance', 'unit']) {
    it(`updates the live ${table} delete client to preview and confirm exact membership`, async function () {
      const response = await requestDeleteWithPreview(request, path(table));
      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
      expect(await stagedKeys()).to.deep.equal(keys(fixture.expected[table]));
    });
  }
});
