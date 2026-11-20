import { expect } from 'chai';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  MethodologyV2,
  ProjectMethodologyV2,
  ProjectV2,
  StagingV2,
  ValidationV2,
  VerificationV2,
} from '../../../src/models/v2/index.js';
import {
  createV2TestHomeOrg,
  getV2HomeOrgId,
  withConfigOverride,
} from '../utils/v2-test-helpers.js';

const endpoints = [
  { path: 'validation', model: ValidationV2 },
  { path: 'verification', model: VerificationV2 },
  { path: 'project-methodology', model: ProjectMethodologyV2 },
];

describe('V2 project child list filters', function () {
  this.timeout(30000);
  let homeOrgUid;
  let trustProxy;
  const otherOrgUid = 'car-232-other-org';
  const projectIds = [uuidv4(), uuidv4(), uuidv4()];
  const methodologyIds = [uuidv4(), uuidv4(), uuidv4()];
  const records = new Map();

  const list = (path, query = {}) =>
    supertest(app)
      .get(`/v2/${path}`)
      .set('X-Forwarded-For', '192.0.2.232')
      .query({ page: 1, limit: 1000, ...query });
  const ids = (rows, model) =>
    rows.map((row) => row[model.primaryKeyAttribute]);

  before(async function () {
    trustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
    await prepareV2Db();
    await createV2TestHomeOrg();
    homeOrgUid = await getV2HomeOrgId();
    for (const [index, cadTrustProjectId] of projectIds.entries()) {
      await ProjectV2.create({
        cadTrustProjectId,
        orgUid: index === 2 ? otherOrgUid : homeOrgUid,
        projectRegistryName: 'CAR-232',
        projectId: `CAR-232-${index}`,
        projectName: `Project filter ${index}`,
        projectSector: ['Agriculture'],
      });
    }
    for (const cadTrustMethodologyId of methodologyIds) {
      await MethodologyV2.create({
        cadTrustMethodologyId,
        methodologyName: 'CAR-232 methodology',
        methodologyCode: cadTrustMethodologyId,
      });
    }
    for (const { path, model } of endpoints) {
      const fixture = [];
      for (let index = 0; index < 5; index += 1) {
        const values = {
          [model.primaryKeyAttribute]: uuidv4(),
          cadTrustProjectId: projectIds[index < 3 ? 0 : index - 2],
          createdByOrgUid: index === 2 ? otherOrgUid : homeOrgUid,
        };
        if (model === ValidationV2) values.validationId = `CAR-232-${index}`;
        if (model === VerificationV2) {
          values.verificationId = `CAR-232-${index}`;
          values.cadTrustValidationId =
            records.get('validation')[index].cadTrustValidationId;
        }
        if (model === ProjectMethodologyV2) {
          values.cadTrustMethodologyId = methodologyIds[index % 3];
        }
        fixture.push((await model.create(values)).toJSON());
      }
      records.set(path, fixture);
    }
  });

  after(async function () {
    app.set('trust proxy', trustProxy);
    for (const model of [VerificationV2, ValidationV2, ProjectMethodologyV2]) {
      await model.destroy({ where: { cadTrustProjectId: projectIds } });
    }
    await ProjectV2.destroy({ where: { cadTrustProjectId: projectIds } });
    await MethodologyV2.destroy({
      where: { cadTrustMethodologyId: methodologyIds },
    });
  });

  for (const { path, model } of endpoints) {
    describe(`GET /v2/${path}`, function () {
      it('keeps the project filter optional', async function () {
        const response = await list(path).expect(200);
        expect(ids(response.body.data, model)).to.include.members(
          ids(records.get(path), model),
        );
      });

      it('returns only the exact requested project across multiple projects', async function () {
        const response = await list(path, {
          cadTrustProjectId: projectIds[0],
        }).expect(200);
        expect(ids(response.body.data, model)).to.have.members(
          ids(records.get(path).slice(0, 3), model),
        );
        expect(response.body.pageCount).to.equal(1);
      });

      it('rejects malformed, empty and repeated project UUID query values', async function () {
        for (const cadTrustProjectId of [
          'not-a-uuid',
          '',
          [projectIds[0], projectIds[1]],
        ]) {
          const response = await list(path, { cadTrustProjectId }).expect(400);
          expect(JSON.stringify(response.body)).to.include('cadTrustProjectId');
        }
      });

      it('returns an empty page for a valid nonmatching UUID', async function () {
        const response = await list(path, {
          cadTrustProjectId: uuidv4(),
        }).expect(200);
        expect(response.body).to.deep.equal({
          page: 1,
          pageCount: 0,
          data: [],
        });
      });

      it('combines project, owner and creator filters including me', async function () {
        for (const orgUid of ['me', homeOrgUid]) {
          const response = await list(path, {
            cadTrustProjectId: projectIds[0],
            orgUid,
            createdByOrgUid: 'me',
          }).expect(200);
          expect(ids(response.body.data, model)).to.have.members(
            ids(records.get(path).slice(0, 2), model),
          );
        }
        const response = await list(path, {
          cadTrustProjectId: projectIds[0],
          orgUid: otherOrgUid,
        }).expect(200);
        expect(response.body).to.deep.equal({
          page: 1,
          pageCount: 0,
          data: [],
        });
      });

      it('combines the project filter with an explicit different creator', async function () {
        const response = await list(path, {
          cadTrustProjectId: projectIds[0],
          createdByOrgUid: otherOrgUid,
        }).expect(200);
        expect(ids(response.body.data, model)).to.deep.equal(
          ids(records.get(path).slice(2, 3), model),
        );
      });

      it('paginates and counts the filtered set', async function () {
        const query = {
          cadTrustProjectId: projectIds[0],
          orgUid: 'me',
          limit: 2,
        };
        const first = await list(path, query).expect(200);
        const second = await list(path, { ...query, page: 2 }).expect(200);
        expect(first.body.pageCount).to.equal(2);
        expect(second.body.pageCount).to.equal(2);
        expect(first.body.data).to.have.length(2);
        expect(second.body.data).to.have.length(1);
        expect(
          ids([...first.body.data, ...second.body.data], model),
        ).to.have.members(ids(records.get(path).slice(0, 3), model));
      });

      it('allows filtered reads in read-only mode without mutating data or staging', async function () {
        const before = await model.findAll({
          where: { cadTrustProjectId: projectIds },
          raw: true,
        });
        const stagingBefore = await StagingV2.findAll({ raw: true });
        await withConfigOverride(
          async () => {
            const response = await list(path, {
              cadTrustProjectId: projectIds[0],
            }).expect(200);
            expect(ids(response.body.data, model)).to.have.members(
              ids(records.get(path).slice(0, 3), model),
            );
          },
          { APP: { READ_ONLY: true } },
        );
        expect(
          await model.findAll({
            where: { cadTrustProjectId: projectIds },
            raw: true,
          }),
        ).to.deep.equal(before);
        expect(await StagingV2.findAll({ raw: true })).to.deep.equal(
          stagingBefore,
        );
      });

      if (model !== ProjectMethodologyV2) {
        it('preserves selected associations with project and organization filters', async function () {
          const response = await list(path, {
            cadTrustProjectId: projectIds[0],
            orgUid: 'me',
            createdByOrgUid: 'me',
            columns:
              model === VerificationV2 ? 'project,validation' : 'project',
            limit: 1,
          }).expect(200);
          expect(response.body.pageCount).to.equal(2);
          expect(response.body.data).to.have.length(1);
          const [record] = response.body.data;
          expect(record.project.cadTrustProjectId).to.equal(projectIds[0]);
          expect(ids(records.get(path).slice(0, 2), model)).to.include(
            record[model.primaryKeyAttribute],
          );
          if (model === VerificationV2) {
            expect(record.validation.cadTrustValidationId).to.equal(
              record.cadTrustValidationId,
            );
          }
        });
      }
    });
  }
});
