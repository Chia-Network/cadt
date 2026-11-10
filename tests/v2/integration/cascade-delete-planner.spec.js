import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import * as cascadeDelete from '../../../src/utils/v2-cascade-delete.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import {
  StagingV2,
  UnitLabelV2,
  VerificationV2,
} from '../../../src/models/v2/index.js';
import {
  createV2TestHomeOrg,
  pauseSchedulerTasks,
  resumeSchedulerTasks,
} from '../utils/v2-test-helpers.js';
import {
  cascadeModels,
  createCascadeFixture,
} from '../utils/cascade-delete-fixture.js';

const memberKey = ({ table, id }) => `${table}:${id}`;
const sortedKeys = (members) => members.map(memberKey).sort();
const dataSnapshot = async () =>
  Promise.all(
    cascadeModels.map(async (model) => [
      model.tableName,
      await model.findAll({
        raw: true,
        order: [[model.primaryKeyAttribute, 'ASC']],
      }),
    ]),
  );

// These tests call the production DELETE endpoints and read actual SQLite rows.
describe('CAR-229 cascade membership', function () {
  this.timeout(30000);
  let fixture;

  before(async function () {
    await prepareV2Db();
    await pauseSchedulerTasks();
    await createV2TestHomeOrg();
  });
  after(async function () {
    await resumeSchedulerTasks();
  });
  beforeEach(async function () {
    await StagingV2.destroy({ where: {} });
    for (const model of cascadeModels) await model.destroy({ where: {} });
    fixture = await createCascadeFixture();
  });

  for (const table of ['project', 'verification', 'issuance', 'unit']) {
    it(`DELETE ${table} stages exactly its root and descendants, preserving shared records and siblings`, async function () {
      const expected = fixture.expected[table];
      const before = await dataSnapshot();
      const preview = await supertest(app)
        .get(`/v2/${table}/${expected[0].id}/delete-preview`)
        .expect(200);
      const response = await supertest(app)
        .delete(`/v2/${table}/${expected[0].id}`)
        .set('X-Deletion-Confirmation', preview.body.confirmationToken)
        .expect(200);
      expect(response.body.success).to.equal(true);
      const rows = await StagingV2.findAll();
      const members = rows.map((row) => {
        expect(row.action).to.equal('DELETE');
        expect(row.committed).to.equal(false);
        const payload = JSON.parse(row.data);
        expect(payload).to.have.length(1);
        expect(Object.keys(payload[0])).to.have.length(1);
        const id = Object.values(payload[0])[0];
        const expectedMember = expected.find(
          (member) => member.table === row.table && member.id === id,
        );
        expect(expectedMember, `unexpected staged member ${row.table}:${id}`).to
          .exist;
        expect(payload[0]).to.deep.equal({
          [expectedMember.primaryKeyField]: id,
        });
        expect(id).not.to.equal(row.uuid);
        return { table: row.table, id };
      });
      expect(sortedKeys(members)).to.deep.equal(sortedKeys(expected));
      expect(response.body.stagedChildDeletes).to.equal(expected.length - 1);
      expect(await dataSnapshot()).to.deep.equal(before);
    });
  }

  for (const table of ['project', 'verification', 'issuance', 'unit']) {
    it(`discovers deterministic unique ${table} members/counts without data writes or staging events`, async function () {
      const expected = fixture.expected[table];
      const before = await dataSnapshot();
      const events = [];
      const subscription = StagingV2.changes.subscribe((event) =>
        events.push(event),
      );
      let first;
      let second;
      try {
        first = await cascadeDelete.discoverCascadeDeletePlan(
          table,
          expected[0].id,
        );
        second = await cascadeDelete.discoverCascadeDeletePlan(
          table,
          expected[0].id,
        );
      } finally {
        subscription.unsubscribe();
      }
      expect(first).to.deep.equal(second);
      expect(first.root).to.deep.equal(expected[0]);
      const tableOrder = [
        'project',
        'location',
        'estimation',
        'rating',
        'co_benefit',
        'validation',
        'project_methodology',
        'stakeholder_projects',
        'verification',
        'issuance',
        'unit',
        'unit_label',
      ];
      const orderedExpected = [...expected].sort(
        (left, right) =>
          tableOrder.indexOf(left.table) - tableOrder.indexOf(right.table) ||
          (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      );
      expect(first.members).to.deep.equal(orderedExpected);
      expect(new Set(first.members.map(memberKey)).size).to.equal(
        expected.length,
      );
      expect(first.totalCount).to.equal(expected.length);
      expect(first.descendantCount).to.equal(expected.length - 1);
      const counts = {};
      for (const member of expected)
        counts[member.table] = (counts[member.table] || 0) + 1;
      expect(first.counts).to.deep.equal(counts);
      for (const member of first.members) {
        expect(member).to.deep.equal(
          expected.find((item) => memberKey(item) === memberKey(member)),
        );
      }
      for (const memberTable of Object.keys(counts)) {
        const ids = first.members
          .filter((member) => member.table === memberTable)
          .map((member) => member.id);
        expect(ids).to.deep.equal([...ids].sort());
      }
      expect(await StagingV2.count()).to.equal(0);
      expect(events).to.deep.equal([]);
      expect(await dataSnapshot()).to.deep.equal(before);
    });

    it(`preserves zero-child ${table} discovery and ordinary DELETE behavior`, async function () {
      const [root, ...children] = fixture.expected[table];
      for (const child of [...children].reverse()) {
        const model = cascadeModels.find(
          (item) => item.tableName === child.table,
        );
        await model.destroy({
          where: { [model.primaryKeyAttribute]: child.id },
        });
      }
      const plan = await cascadeDelete.discoverCascadeDeletePlan(
        table,
        root.id,
      );
      expect(plan).to.deep.equal({
        root,
        members: [root],
        counts: { [table]: 1 },
        totalCount: 1,
        descendantCount: 0,
      });
      const response = await supertest(app)
        .delete(`/v2/${table}/${root.id}`)
        .expect(200);
      expect(response.body.stagedChildDeletes).to.equal(0);
      const rows = await StagingV2.findAll();
      expect(rows).to.have.length(1);
      expect(rows[0].table).to.equal(root.table);
      expect(JSON.parse(rows[0].data)).to.deep.equal([
        { [root.primaryKeyField]: root.id },
      ]);
    });

    for (const failure of ['child', 'parent']) {
      it(`rolls back every ${table} staged row after an actual ${failure} write fails`, async function () {
        const expected = fixture.expected[table];
        const before = await dataSnapshot();
        const hook = failure === 'child' ? 'afterBulkCreate' : 'afterCreate';
        const error = new Error(`CAR229 injected ${failure} failure`);
        let reached = false;
        StagingV2.addHook(hook, 'car229-fault', () => {
          reached = true;
          throw error;
        });
        try {
          const preview = await supertest(app)
            .get(`/v2/${table}/${expected[0].id}/delete-preview`)
            .expect(200);
          const response = await supertest(app)
            .delete(`/v2/${table}/${expected[0].id}`)
            .set('X-Deletion-Confirmation', preview.body.confirmationToken)
            .expect(400);
          expect(response.body.success).to.equal(false);
          expect(response.body.error).to.equal(error.message);
        } finally {
          StagingV2.removeHook(hook, 'car229-fault');
        }
        expect(reached).to.equal(true);
        expect(await StagingV2.count()).to.equal(0);
        expect(await dataSnapshot()).to.deep.equal(before);
      });
    }
  }

  it('uses every supplied transaction query and leaves its uncommitted snapshot caller-owned', async function () {
    const transaction = await sequelizeV2.transaction({
      type: Transaction.TYPES.DEFERRED,
    });
    const id = uuidv4();
    const seen = [];
    const queriedModels = cascadeModels.filter(
      (model) =>
        !['project', 'program', 'methodology', 'stakeholder', 'label'].includes(
          model.tableName,
        ),
    );
    try {
      await UnitLabelV2.create(
        {
          cadTrustUnitLabelId: id,
          cadTrustUnitId: fixture.records.aV1I1U1.id,
          cadTrustLabelId: fixture.records.label.id,
        },
        { transaction },
      );
      for (const model of queriedModels)
        model.addHook('beforeFind', 'car229-transaction', (options) =>
          seen.push(options.transaction),
        );
      const plan = await cascadeDelete.discoverCascadeDeletePlan(
        'project',
        fixture.records.aProject.id,
        { transaction },
      );
      expect(plan.members.map(memberKey)).to.include(`unit_label:${id}`);
      expect(seen).to.have.length(11);
      expect(seen.every((item) => item === transaction)).to.equal(true);
      expect(transaction.finished).to.equal(undefined);
      expect(await StagingV2.count({ transaction })).to.equal(0);
    } finally {
      for (const model of queriedModels)
        model.removeHook('beforeFind', 'car229-transaction');
      await transaction.rollback();
    }
    expect(await UnitLabelV2.findByPk(id)).to.equal(null);
  });

  it('opens one DEFERRED snapshot and excludes a committed graph change between its SELECTs', async function () {
    const id = uuidv4();
    let readTransaction;
    let writerTransaction;
    let reached = false;
    VerificationV2.addHook(
      'afterFind',
      'car229-interleave',
      async (_records, options) => {
        if (reached) return;
        reached = true;
        readTransaction = options.transaction;
        expect(readTransaction).to.exist;
        expect(readTransaction.options.type).to.equal(
          Transaction.TYPES.DEFERRED,
        );
        await sequelizeV2.transaction(async (transaction) => {
          writerTransaction = transaction;
          await UnitLabelV2.create(
            {
              cadTrustUnitLabelId: id,
              cadTrustUnitId: fixture.records.aV1I1U1.id,
              cadTrustLabelId: fixture.records.label.id,
            },
            { transaction },
          );
        });
      },
    );
    let plan;
    try {
      plan = await cascadeDelete.discoverCascadeDeletePlan(
        'project',
        fixture.records.aProject.id,
      );
    } finally {
      VerificationV2.removeHook('afterFind', 'car229-interleave');
    }
    expect(reached).to.equal(true);
    expect(readTransaction.connection).not.to.equal(
      writerTransaction.connection,
    );
    expect(writerTransaction.finished).to.equal('commit');
    expect(readTransaction.finished).to.equal('commit');
    expect(sortedKeys(plan.members)).to.deep.equal(
      sortedKeys(fixture.expected.project),
    );
    const current = await cascadeDelete.discoverCascadeDeletePlan(
      'project',
      fixture.records.aProject.id,
    );
    expect(current.members.map(memberKey)).to.include(`unit_label:${id}`);
    expect(current.totalCount).to.equal(plan.totalCount + 1);
    expect(await StagingV2.count()).to.equal(0);
  });
});
