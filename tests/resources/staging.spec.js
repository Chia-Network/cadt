import app from '../../src/server';
import supertest from 'supertest';
import newProject from '../test-data/new-project.js';
import { pullPickListValues } from '../../src/utils/data-loaders';
import { expect } from 'chai';
import sinon from 'sinon';
import { prepareDb } from '../../src/database';
import datalayer from '../../src/datalayer';
import { Issuance, Project, Staging, Unit } from '../../src/models';
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

describe('Staging Resource CRUD', function () {
  before(async function () {
    await pullPickListValues();
    await prepareDb();
  });

  beforeEach(async function () {
    await supertest(app).delete(`/v1/staging/clean`);
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('GET - Find all Staging Records', function () {
    it('shows all commited and none committed staging records', async function () {
      await supertest(app).post('/v1/projects').send(newProject);

      const response = await supertest(app).get('/v1/staging');
      expect(response.body.length).to.equal(1);
    }).timeout(TEST_WAIT_TIME * 10);
    it('generates a diff object for the change', async function () {
      const responseCreate = await supertest(app)
        .post('/v1/projects')
        .send(newProject);

      const response = await supertest(app).get('/v1/staging');
      console.info('responseCreate.body[0]', responseCreate.body);
      console.info('response.body[0]', response.body[0]);
      expect(response.body[0].diff.original).to.deep.equal({});
      expect(
        response.body[0].diff.change[0].coBenefits[0].cobenefit,
      ).to.deep.equal(
        'Biodiversity through planting a variety of trees that are home to many native Singaporean species',
      );
    }).timeout(TEST_WAIT_TIME * 10);

    it('uses findAll instead of findAndCountAll for unpaginated reads', async function () {
      const stagedRows = [
        {
          id: 1,
          uuid: 'unit-1',
          table: 'Units',
          action: 'DELETE',
          data: '{}',
          dataValues: {
            id: 1,
            uuid: 'unit-1',
            table: 'Units',
            action: 'DELETE',
            data: '{}',
          },
        },
        {
          id: 2,
          uuid: 'unit-2',
          table: 'Units',
          action: 'DELETE',
          data: '{}',
          dataValues: {
            id: 2,
            uuid: 'unit-2',
            table: 'Units',
            action: 'DELETE',
            data: '{}',
          },
        },
      ];
      const findAllStub = sinon.stub(Staging, 'findAll').resolves(stagedRows);
      const findAndCountAllStub = sinon.stub(Staging, 'findAndCountAll');
      const getDiffObjectsStub = sinon.stub(Staging, 'getDiffObjects').resolves([
        { original: { warehouseUnitId: 'unit-1' }, change: {} },
        { original: { warehouseUnitId: 'unit-2' }, change: {} },
      ]);

      const response = await supertest(app).get('/v1/staging').expect(200);

      expect(findAllStub.calledOnce).to.be.true;
      expect(findAndCountAllStub.called).to.be.false;
      expect(getDiffObjectsStub.calledOnce).to.be.true;
      expect(getDiffObjectsStub.firstCall.args[0]).to.deep.equal(stagedRows);
      expect(findAllStub.firstCall.args[0]).to.deep.equal({
        where: {},
        order: [['id', 'ASC']],
      });
      expect(response.body).to.have.length(2);
      expect(response.body[0].diff.original.warehouseUnitId).to.equal('unit-1');
      expect(response.body[1].diff.original.warehouseUnitId).to.equal('unit-2');
    });

    it('uses findAndCountAll for paginated reads', async function () {
      const stagedRows = [
        {
          id: 3,
          uuid: 'unit-3',
          table: 'Units',
          action: 'DELETE',
          data: '{}',
          dataValues: {
            id: 3,
            uuid: 'unit-3',
            table: 'Units',
            action: 'DELETE',
            data: '{}',
          },
        },
        {
          id: 4,
          uuid: 'unit-4',
          table: 'Units',
          action: 'DELETE',
          data: '{}',
          dataValues: {
            id: 4,
            uuid: 'unit-4',
            table: 'Units',
            action: 'DELETE',
            data: '{}',
          },
        },
      ];
      const findAllStub = sinon.stub(Staging, 'findAll');
      const findAndCountAllStub = sinon.stub(Staging, 'findAndCountAll').resolves({
        count: 2,
        rows: stagedRows,
      });
      const getDiffObjectsStub = sinon.stub(Staging, 'getDiffObjects').resolves([
        { original: { warehouseUnitId: 'unit-3' }, change: {} },
        { original: { warehouseUnitId: 'unit-4' }, change: {} },
      ]);

      const response = await supertest(app)
        .get('/v1/staging')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(findAndCountAllStub.calledOnce).to.be.true;
      expect(findAllStub.called).to.be.false;
      expect(getDiffObjectsStub.calledOnce).to.be.true;
      expect(getDiffObjectsStub.firstCall.args[0]).to.deep.equal(stagedRows);
      expect(findAndCountAllStub.firstCall.args[0]).to.deep.equal({
        distinct: true,
        where: {},
        order: [['id', 'ASC']],
        limit: 10,
        offset: 0,
      });
      expect(response.body.page).to.equal(1);
      expect(response.body.pageCount).to.equal(1);
      expect(response.body.data).to.have.length(2);
      expect(response.body.data[0].diff.original.warehouseUnitId).to.equal('unit-3');
      expect(response.body.data[1].diff.original.warehouseUnitId).to.equal('unit-4');
    });

    it('treats limit-only reads as unpaginated', async function () {
      const stagedRow = {
        id: 1,
        uuid: 'unit-1',
        table: 'Units',
        action: 'DELETE',
        data: '{}',
        dataValues: {
          id: 1,
          uuid: 'unit-1',
          table: 'Units',
          action: 'DELETE',
          data: '{}',
        },
      };
      const findAllStub = sinon.stub(Staging, 'findAll').resolves([stagedRow]);
      const findAndCountAllStub = sinon.stub(Staging, 'findAndCountAll');
      const getDiffObjectsStub = sinon
        .stub(Staging, 'getDiffObjects')
        .resolves([{ original: { warehouseUnitId: 'unit-1' }, change: {} }]);

      const response = await supertest(app)
        .get('/v1/staging')
        .query({ limit: 10 })
        .expect(200);

      expect(findAllStub.calledOnce).to.be.true;
      expect(findAndCountAllStub.called).to.be.false;
      expect(getDiffObjectsStub.calledOnce).to.be.true;
      expect(findAllStub.firstCall.args[0]).to.deep.equal({
        where: {},
        order: [['id', 'ASC']],
      });
      expect(response.body).to.have.length(1);
      expect(response.body[0].diff.original.warehouseUnitId).to.equal('unit-1');
    });
  });

  describe('Diff batching', function () {
    it('batches unit original lookups for delete diffs', async function () {
      const unitFindOneStub = sinon.stub(Unit, 'findOne');
      const unitFindAllStub = sinon.stub(Unit, 'findAll').resolves([
        { warehouseUnitId: 'unit-2', issuance: { id: 'iss-2' } },
        { warehouseUnitId: 'unit-1', issuance: { id: 'iss-1' } },
      ]);

      const diffs = await Staging.getDiffObjects([
        { uuid: 'unit-1', table: 'Units', action: 'DELETE', data: '{}' },
        { uuid: 'unit-2', table: 'Units', action: 'DELETE', data: '{}' },
      ]);

      expect(unitFindAllStub.calledOnce).to.be.true;
      expect(unitFindOneStub.called).to.be.false;
      expect(unitFindAllStub.firstCall.args[0].include).to.be.an('array').that.is
        .not.empty;
      expect(diffs[0].original.warehouseUnitId).to.equal('unit-1');
      expect(diffs[1].original.warehouseUnitId).to.equal('unit-2');
      expect(diffs[0].original.issuance.id).to.equal('iss-1');
      expect(diffs[1].original.issuance.id).to.equal('iss-2');
      expect(diffs[0].change).to.deep.equal({});
      expect(diffs[1].change).to.deep.equal({});
    });

    it('batches project original lookups for delete diffs', async function () {
      const projectFindOneStub = sinon.stub(Project, 'findOne');
      const projectFindAllStub = sinon.stub(Project, 'findAll').resolves([
        { warehouseProjectId: 'project-2', issuances: [{ id: 'iss-2' }] },
        { warehouseProjectId: 'project-1', issuances: [{ id: 'iss-1' }] },
      ]);

      const diffs = await Staging.getDiffObjects([
        { uuid: 'project-1', table: 'Projects', action: 'DELETE', data: '{}' },
        { uuid: 'project-2', table: 'Projects', action: 'DELETE', data: '{}' },
      ]);

      expect(projectFindAllStub.calledOnce).to.be.true;
      expect(projectFindOneStub.called).to.be.false;
      expect(projectFindAllStub.firstCall.args[0].include).to.be.an('array').that
        .is.not.empty;
      expect(diffs[0].original.warehouseProjectId).to.equal('project-1');
      expect(diffs[1].original.warehouseProjectId).to.equal('project-2');
      expect(diffs[0].original.issuances[0].id).to.equal('iss-1');
      expect(diffs[1].original.issuances[0].id).to.equal('iss-2');
      expect(diffs[0].change).to.deep.equal({});
      expect(diffs[1].change).to.deep.equal({});
    });

    it('batches issuance lookups when update changes reuse issuances', async function () {
      const unitFindAllStub = sinon.stub(Unit, 'findAll').resolves([
        { warehouseUnitId: 'unit-1' },
        { warehouseUnitId: 'unit-2' },
      ]);
      const issuanceFindAllStub = sinon.stub(Issuance, 'findAll').resolves([
        { id: 'iss-1', dataValues: { id: 'iss-1', verificationBody: 'Verifier' } },
      ]);

      const diffs = await Staging.getDiffObjects([
        {
          uuid: 'unit-1',
          table: 'Units',
          action: 'UPDATE',
          data: JSON.stringify([{ issuanceId: 'iss-1', unitCount: 1 }]),
        },
        {
          uuid: 'unit-2',
          table: 'Units',
          action: 'UPDATE',
          data: JSON.stringify([{ issuanceId: 'iss-1', unitCount: 2 }]),
        },
      ]);

      expect(unitFindAllStub.calledOnce).to.be.true;
      expect(issuanceFindAllStub.calledOnce).to.be.true;
      expect(diffs[0].change[0].issuance.id).to.equal('iss-1');
      expect(diffs[1].change[0].issuance.verificationBody).to.equal('Verifier');
    });

    it('batches issuance lookups for project updates too', async function () {
      const projectFindAllStub = sinon.stub(Project, 'findAll').resolves([
        { warehouseProjectId: 'project-2' },
        { warehouseProjectId: 'project-1' },
      ]);
      const issuanceFindAllStub = sinon.stub(Issuance, 'findAll').resolves([
        { id: 'iss-2', dataValues: { id: 'iss-2', verificationBody: 'Project Verifier' } },
      ]);

      const diffs = await Staging.getDiffObjects([
        {
          uuid: 'project-1',
          table: 'Projects',
          action: 'UPDATE',
          data: JSON.stringify([{ issuanceId: 'iss-2', projectName: 'Updated Project' }]),
        },
        {
          uuid: 'project-2',
          table: 'Projects',
          action: 'UPDATE',
          data: JSON.stringify([{ issuanceId: 'iss-2', projectName: 'Updated Project 2' }]),
        },
      ]);

      expect(projectFindAllStub.calledOnce).to.be.true;
      expect(issuanceFindAllStub.calledOnce).to.be.true;
      expect(diffs[0].change[0].issuance.id).to.equal('iss-2');
      expect(diffs[0].change[0].issuance.verificationBody).to.equal(
        'Project Verifier',
      );
      expect(diffs[1].change[0].issuance.id).to.equal('iss-2');
    });

    it('throws when an update references a missing issuance', async function () {
      sinon.stub(Unit, 'findAll').resolves([{ warehouseUnitId: 'unit-1' }]);
      sinon.stub(Issuance, 'findAll').resolves([]);

      try {
        await Staging.getDiffObjects([
          {
            uuid: 'unit-1',
            table: 'Units',
            action: 'UPDATE',
            data: JSON.stringify([{ issuanceId: 'missing-issuance', unitCount: 1 }]),
          },
        ]);
        expect.fail('Expected missing issuance lookup to throw');
      } catch (error) {
        expect(error.message).to.include(
          "Could not find issuance 'missing-issuance'",
        );
      }
    });

    it('preserves generic update payloads for non-project staging tables', async function () {
      const diffs = await Staging.getDiffObjects([
        {
          uuid: 'label-1',
          table: 'Labels',
          action: 'UPDATE',
          data: JSON.stringify([{ label: 'updated-label' }]),
        },
      ]);

      expect(diffs[0].change).to.deep.equal([{ label: 'updated-label' }]);
      expect(diffs[0].original).to.equal(undefined);
    });

    it('returns null when a batched original record is missing', async function () {
      sinon.stub(Unit, 'findAll').resolves([]);

      const diffs = await Staging.getDiffObjects([
        { uuid: 'missing-unit', table: 'Units', action: 'DELETE', data: '{}' },
      ]);

      expect(diffs[0].original).to.equal(null);
      expect(diffs[0].change).to.deep.equal({});
    });

    it('preserves the single-record getDiffObject adapter', async function () {
      const getDiffObjectsStub = sinon.stub(Staging, 'getDiffObjects').resolves([
        { original: { warehouseUnitId: 'unit-99' }, change: {} },
      ]);

      const diff = await Staging.getDiffObject(
        'unit-99',
        'Units',
        'DELETE',
        '{}',
      );

      expect(getDiffObjectsStub.calledOnce).to.be.true;
      expect(getDiffObjectsStub.firstCall.args[0]).to.deep.equal([
        { uuid: 'unit-99', table: 'Units', action: 'DELETE', data: '{}' },
      ]);
      expect(diff).to.deep.equal({
        original: { warehouseUnitId: 'unit-99' },
        change: {},
      });
    });
  });

  describe('POST - Commit Records to datalayer', function () {
    it('can commit just the project staging records optionally', async function () {
      await supertest(app).post('/v1/projects').send(newProject);
    });
  });

  describe('DELETE - Delete a single staging record', function () {
    it.skip('Removes the staging record from the staging table', async function () {
      await supertest(app).post('/v1/projects').send(newProject);
      await supertest(app).post('/v1/projects').send(newProject);
      await supertest(app).post('/v1/projects').send(newProject);
      const response = await supertest(app).get('/v1/staging');

      const deletedId = response.body[0].uuid;
      await supertest(app).delete(`/v1/staging`).send({ uuid: deletedId });
      const responseDeleted = await supertest(app).get('/v1/staging');
      // expect(responseDeleted.body.length).to.equal(2);
      expect(responseDeleted.body.find((r) => r.uuid === deletedId)).to.equal(
        undefined,
      );
    });
  });

  describe('DELETE - Clears the staging table', function () {
    it.skip('Clears the staging table', async function () {
      await supertest(app).delete('/v1/staging/clean');
      /// const response = await supertest(app).get('/v1/staging');
      // expect(response.body).to.deep.equal(0);
    });
  });
});
