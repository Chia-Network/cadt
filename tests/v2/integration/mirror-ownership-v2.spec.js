import { expect } from 'chai';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';

import {
  prepareV2Db,
  sequelizeV2,
  sequelizeV2Mirror,
  checkForV2Migrations,
  backfillMirrorV2,
  __setMirrorEnabledForTestsV2,
  __setMirrorSetupSucceededForTestsV2,
  __resetMirrorAuthStateForTestsV2,
} from '../../../src/database/v2/index.js';
import {
  LabelV2,
  LabelV2Mirror,
  StakeholderV2,
  StakeholderV2Mirror,
  AefT1SubmissionV2,
  AefT1SubmissionV2Mirror,
} from '../../../src/models/v2/index.js';

const pairs = [
  {
    source: LabelV2,
    mirror: LabelV2Mirror,
    values: { labelName: 'Ownership label' },
  },
  {
    source: StakeholderV2,
    mirror: StakeholderV2Mirror,
    values: { stakeholderName: 'Ownership stakeholder' },
  },
  {
    source: AefT1SubmissionV2,
    mirror: AefT1SubmissionV2Mirror,
    values: {
      aefT1SubmissionParty: 'Party',
      aefT1SubmissionVersion: '1',
      aefT1SubmissionReportYear: 2026,
      aefT1SubmissionSubmissionDate: '2026-01-01',
    },
  },
];
const when = '2026-01-01 00:00:00.000 +00:00';
const owner = 'a'.repeat(64);
const nextOwner = 'b'.repeat(64);

// Seed real source/mirror databases without invoking the normal mirror writer.
const seed = async (target, pair, id, orgUid, updatedAt = when) => {
  const values = {
    ...pair.values,
    [pair.source.primaryKeyAttribute]: id,
    orgUid,
  };
  const row = Object.fromEntries(
    Object.entries(values).map(([attr, value]) => [
      pair.source.rawAttributes[attr].field,
      value,
    ]),
  );
  await target
    .getQueryInterface()
    .bulkInsert(pair.source.tableName, [
      { ...row, created_at: when, updated_at: updatedAt },
    ]);
};

// Read the physical column, so missing ORM metadata cannot hide a NULL value.
const readRow = async (target, pair, id) => {
  const pk = pair.source.rawAttributes[pair.source.primaryKeyAttribute].field;
  const rows = await target.query(
    `SELECT * FROM ${pair.source.tableName} WHERE ${pk} = :id`,
    { replacements: { id }, type: QueryTypes.SELECT },
  );
  expect(rows).to.have.lengthOf(1);
  return rows[0];
};

describe('V2 mirror ownership', function () {
  this.timeout(60000);

  before(async function () {
    await prepareV2Db();
    await checkForV2Migrations(sequelizeV2Mirror);
  });

  beforeEach(function () {
    __setMirrorEnabledForTestsV2(true);
    __setMirrorSetupSucceededForTestsV2(true);
  });

  afterEach(async function () {
    sinon.restore();
    __setMirrorEnabledForTestsV2(null);
    __setMirrorSetupSucceededForTestsV2(false);
    __resetMirrorAuthStateForTestsV2();
    for (const pair of pairs) {
      for (const target of [sequelizeV2, sequelizeV2Mirror]) {
        await target.getQueryInterface().bulkDelete(pair.source.tableName, {});
      }
    }
  });

  it('falls through to backfill when the ownership lookup fails', async function () {
    const pair = pairs[0];
    const id = uuidv4();
    await seed(sequelizeV2, pair, id, owner);
    await seed(sequelizeV2Mirror, pair, id, null);
    sinon
      .stub(pair.source, 'findOne')
      .rejects(new Error('Ownership lookup unavailable'));
    await backfillMirrorV2();
    expect((await readRow(sequelizeV2Mirror, pair, id)).org_uid).to.equal(
      owner,
    );
  });

  it('checks past a full legacy-NULL batch after the orphan sweep', async function () {
    const pair = pairs[0];
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      cad_trust_label_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      label_name: 'Ownership pagination',
      org_uid: index === 1000 ? owner : null,
      created_at: when,
      updated_at: when,
    }));
    await sequelizeV2.getQueryInterface().bulkInsert('label', rows);
    await sequelizeV2Mirror.getQueryInterface().bulkInsert('label', [
      ...rows.map((row) => ({ ...row, org_uid: null })),
      {
        ...rows[0],
        cad_trust_label_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      },
    ]);
    await backfillMirrorV2();
    expect(await pair.mirror.count()).to.equal(rows.length);
    expect(
      (await readRow(sequelizeV2Mirror, pair, rows[1000].cad_trust_label_id))
        .org_uid,
    ).to.equal(owner);
    expect(await pair.mirror.count({ where: { orgUid: null } })).to.equal(1000);
  });

  for (const pair of pairs) {
    describe(pair.source.tableName, function () {
      it('maps the nullable 64-character source owner to org_uid', function () {
        const attr = pair.mirror.rawAttributes.orgUid;
        expect(attr, 'mirror must map the existing org_uid column').to.exist;
        expect(attr.field).to.equal('org_uid');
        expect(attr.allowNull).to.equal(true);
        expect(attr.type.toSql()).to.equal('VARCHAR(64)');
      });

      it('mirrors new owners, owner updates and an explicitly unknown owner', async function () {
        const id = uuidv4();
        const options = { where: { [pair.source.primaryKeyAttribute]: id } };
        // Production transactional writes await the actual mirror operation.
        await sequelizeV2Mirror.transaction(async (mirrorTransaction) => {
          await pair.source.create(
            {
              ...pair.values,
              [pair.source.primaryKeyAttribute]: id,
              orgUid: owner,
            },
            { mirrorTransaction },
          );
        });
        expect((await readRow(sequelizeV2Mirror, pair, id)).org_uid).to.equal(
          owner,
        );

        for (const orgUid of [nextOwner, null]) {
          await sequelizeV2Mirror.transaction(async (mirrorTransaction) => {
            await pair.source.update(
              { orgUid },
              { ...options, mirrorTransaction },
            );
          });
          expect((await readRow(sequelizeV2, pair, id)).org_uid).to.equal(
            orgUid,
          );
          expect((await readRow(sequelizeV2Mirror, pair, id)).org_uid).to.equal(
            orgUid,
          );
        }
      });

      it('backfills owners and legacy NULLs for missing mirror rows', async function () {
        const knownId = uuidv4();
        const unknownId = uuidv4();
        await seed(sequelizeV2, pair, knownId, owner);
        await seed(sequelizeV2, pair, unknownId, null);
        await backfillMirrorV2();
        expect(
          (await readRow(sequelizeV2Mirror, pair, knownId)).org_uid,
        ).to.equal(owner);
        expect(
          (await readRow(sequelizeV2Mirror, pair, unknownId)).org_uid,
        ).to.equal(null);
      });

      for (const mirrorWhen of [when, '2026-02-01 00:00:00.000 +00:00']) {
        it(`repairs a NULL owner with equal counts and mirror updated_at ${mirrorWhen}`, async function () {
          const id = uuidv4();
          await seed(sequelizeV2, pair, id, owner);
          await seed(sequelizeV2Mirror, pair, id, null, mirrorWhen);
          const healthyId = uuidv4();
          const unknownId = uuidv4();
          for (const target of [sequelizeV2, sequelizeV2Mirror]) {
            await seed(target, pair, healthyId, nextOwner);
            await seed(target, pair, unknownId, null);
          }
          expect(await pair.source.count()).to.equal(await pair.mirror.count());
          const bulkCreate = sinon.spy(pair.mirror, 'bulkCreate');
          await backfillMirrorV2();
          expect((await readRow(sequelizeV2Mirror, pair, id)).org_uid).to.equal(
            owner,
          );
          expect((await readRow(sequelizeV2, pair, id)).org_uid).to.equal(
            owner,
          );
          expect(
            (await readRow(sequelizeV2Mirror, pair, healthyId)).org_uid,
          ).to.equal(nextOwner);
          expect(
            (await readRow(sequelizeV2Mirror, pair, unknownId)).org_uid,
          ).to.equal(null);
          expect(bulkCreate.called).to.equal(true);
          bulkCreate.resetHistory();
          await backfillMirrorV2();
          expect(
            bulkCreate.called,
            'repaired owners must permit the healthy skip',
          ).to.equal(false);
        });
      }

      it('retains healthy owners and unknown source owners without needless upserts', async function () {
        for (const orgUid of [owner, null]) {
          const id = uuidv4();
          await seed(sequelizeV2, pair, id, orgUid);
          await seed(sequelizeV2Mirror, pair, id, orgUid);
        }
        const before = await pair.mirror.findAll({ raw: true });
        const bulkCreate = sinon.spy(pair.mirror, 'bulkCreate');
        await backfillMirrorV2();
        expect(bulkCreate.called).to.equal(false);
        expect(await pair.mirror.findAll({ raw: true })).to.deep.equal(before);
      });
    });
  }
});
