import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2, MetaV2 } from '../../../src/models/v2/index.js';
import { Organization, Meta } from '../../../src/models/index.js';
import {
  tryAcquireOrgLock,
  releaseOrgLock,
  updateOrgLockStatus,
  getOrgLockStatus,
} from '../../../src/utils/org-operation-lock.js';
import {
  createInitialState,
  saveCreationState,
  clearCreationState,
  ORG_CREATION_STATES,
} from '../../../src/utils/organization-creation-state.js';

describe('Organization Operation Lock - Endpoint Guards', function () {
  this.timeout(60000);

  before(async function () {
    await prepareV2Db();
  });

  afterEach(async function () {
    releaseOrgLock();
    await OrganizationsV2.destroy({ where: {} });
    await Organization.destroy({ where: {} });
    await clearCreationState(MetaV2, 'v2');
    await clearCreationState(Meta, 'v1');
  });

  // ----------------------------------------------------------------
  // V2 Create -- in-memory lock guard
  // ----------------------------------------------------------------
  describe('V2 Create -- in-memory lock guard', function () {
    it('rejects when lock held', async function () {
      tryAcquireOrgLock('V2 organization creation');
      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
      expect(res.body.success).to.be.false;
    });

    it('rejects when Meta state in-progress', async function () {
      const state = createInitialState('Test', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(state, MetaV2);

      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('still in progress');
      expect(res.body.success).to.be.false;
    });

    it('succeeds when lock free and no Meta state (simulator)', async function () {
      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
    });
  });

  // ----------------------------------------------------------------
  // V2 Upgrade -- in-memory lock guard
  // ----------------------------------------------------------------
  describe('V2 Upgrade -- in-memory lock guard', function () {
    it('rejects when lock held by create', async function () {
      tryAcquireOrgLock('V2 organization creation');
      const res = await supertest(app)
        .post('/v2/organizations/upgrade');

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
    });

    it('rejects when lock held by upgrade', async function () {
      tryAcquireOrgLock('V1 to V2 upgrade');
      const res = await supertest(app)
        .post('/v2/organizations/upgrade');

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
    });

    it('rejects when Meta state in-progress', async function () {
      const state = createInitialState('Test', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(state, MetaV2);

      const res = await supertest(app)
        .post('/v2/organizations/upgrade');

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('still in progress');
    });
  });

  // ----------------------------------------------------------------
  // V2 Reclaim -- in-memory lock guard
  // ----------------------------------------------------------------
  describe('V2 Reclaim -- in-memory lock guard', function () {
    it('rejects when lock held', async function () {
      tryAcquireOrgLock('V2 organization creation');
      const res = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: 'f1c54511-865e-4611-976c-7c3c1f704662' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
    });
  });

  // ----------------------------------------------------------------
  // V1 Create -- in-memory lock guard
  // ----------------------------------------------------------------
  describe('V1 Create -- in-memory lock guard', function () {
    it('rejects when lock held', async function () {
      tryAcquireOrgLock('V1 organization creation');
      const res = await supertest(app)
        .post('/v1/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
    });

    it('rejects when Meta state in-progress', async function () {
      const state = createInitialState('Test', '', 'v1', 'v1');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(state, Meta);

      const res = await supertest(app)
        .post('/v1/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('still in progress');
    });
  });

  // ----------------------------------------------------------------
  // Cross-version blocking
  // ----------------------------------------------------------------
  describe('Cross-version blocking', function () {
    it('V1 lock blocks V2 create', async function () {
      tryAcquireOrgLock('V1 organization creation');
      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
      expect(res.body.message).to.include('V1 organization creation');
    });

    it('V2 lock blocks V1 create', async function () {
      tryAcquireOrgLock('V2 organization creation');
      const res = await supertest(app)
        .post('/v1/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
      expect(res.body.message).to.include('V2 organization creation');
    });

    it('V2 upgrade lock blocks V2 create', async function () {
      tryAcquireOrgLock('V1 to V2 upgrade');
      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.include('already in progress');
      expect(res.body.message).to.include('V1 to V2 upgrade');
    });
  });

  // ----------------------------------------------------------------
  // Lock release after operation
  // ----------------------------------------------------------------
  describe('Lock release after operation', function () {
    it('lock released after successful create (simulator)', async function () {
      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Release Test Org' });

      expect(res.status).to.equal(200);

      // In simulator mode, creation is awaited so lock should be released
      await new Promise(resolve => setImmediate(resolve));
      expect(getOrgLockStatus()).to.be.null;
    });
  });

  // ----------------------------------------------------------------
  // 409 response body format
  // ----------------------------------------------------------------
  describe('409 response body matches documented API contract', function () {
    it('409 includes all documented fields', async function () {
      const token = tryAcquireOrgLock('V2 organization creation');
      updateOrgLockStatus(token, 'Waiting for store');

      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      expect(res.body.message).to.be.a('string').that.includes('already in progress');
      expect(res.body.success).to.be.false;
      expect(res.body.operationStatus).to.be.an('object');
    });

    it('operationStatus has all documented fields', async function () {
      const token = tryAcquireOrgLock('V2 organization creation');
      updateOrgLockStatus(token, 'Waiting for store');

      const res = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Test Org' });

      expect(res.status).to.equal(409);
      const opStatus = res.body.operationStatus;
      expect(opStatus.operation).to.be.a('string');
      expect(opStatus.status).to.be.a('string');
      expect(opStatus.startedAt).to.be.a('string');
      expect(new Date(opStatus.startedAt).toISOString()).to.equal(opStatus.startedAt);
      expect(opStatus.elapsedSeconds).to.be.a('number').that.is.at.least(0);
    });

    it('409 on upgrade includes operationStatus', async function () {
      tryAcquireOrgLock('V2 organization creation');
      const res = await supertest(app)
        .post('/v2/organizations/upgrade');

      expect(res.status).to.equal(409);
      expect(res.body.operationStatus.operation).to.equal('V2 organization creation');
    });

    it('409 on reclaim includes operationStatus', async function () {
      tryAcquireOrgLock('V1 to V2 upgrade');
      const res = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: 'f1c54511-865e-4611-976c-7c3c1f704662' });

      expect(res.status).to.equal(409);
      expect(res.body.operationStatus.operation).to.equal('V1 to V2 upgrade');
    });
  });

  // ----------------------------------------------------------------
  // creation-status endpoint shows lock status
  // ----------------------------------------------------------------
  describe('creation-status endpoint shows lock status', function () {
    it('returns lock status when upgrade in progress', async function () {
      const token = tryAcquireOrgLock('V1 to V2 upgrade');
      updateOrgLockStatus(token, 'Creating registry store');

      const res = await supertest(app)
        .get('/v2/organizations/creation-status');

      expect(res.status).to.equal(200);
      expect(res.body.inProgress).to.be.true;
      expect(res.body.operation).to.equal('V1 to V2 upgrade');
      expect(res.body.liveStatus).to.be.an('object');
      expect(res.body.liveStatus.operation).to.equal('V1 to V2 upgrade');
      expect(res.body.liveStatus.status).to.equal('Creating registry store');
      expect(res.body.liveStatus.elapsedSeconds).to.be.a('number');
    });

    it('returns no lock status when idle', async function () {
      releaseOrgLock();
      await clearCreationState(MetaV2, 'v2');

      const res = await supertest(app)
        .get('/v2/organizations/creation-status');

      expect(res.status).to.equal(200);
      expect(res.body.inProgress).to.be.false;
      expect(res.body).to.not.have.property('liveStatus');
    });

    it('returns both Meta and lock status during creation', async function () {
      const state = createInitialState('Test', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(state, MetaV2);

      const token = tryAcquireOrgLock('V2 organization creation');
      updateOrgLockStatus(token, 'Creating stores on blockchain');

      const res = await supertest(app)
        .get('/v2/organizations/creation-status');

      expect(res.status).to.equal(200);
      expect(res.body.state).to.equal('STORES_CREATING');
      expect(res.body.liveStatus).to.exist;
      expect(res.body.liveStatus.operation).to.equal('V2 organization creation');
      expect(res.body.liveStatus.status).to.equal('Creating stores on blockchain');
    });

    it('liveStatus reflects updated status', async function () {
      const token = tryAcquireOrgLock('test');
      updateOrgLockStatus(token, 'A');
      updateOrgLockStatus(token, 'B');

      const res = await supertest(app)
        .get('/v2/organizations/creation-status');

      expect(res.status).to.equal(200);
      expect(res.body.liveStatus.status).to.equal('B');
    });
  });
});
