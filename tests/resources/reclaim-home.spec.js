import { expect } from 'chai';
import sinon from 'sinon';
import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { prepareDb } from '../../src/database';
import { pullPickListValues } from '../../src/utils/data-loaders';
import datalayer from '../../src/datalayer';
import * as dataAssertions from '../../src/utils/data-assertions.js';
import { getConfig } from '../../src/utils/config-loader.js';

const { USE_SIMULATOR } = getConfig().APP;

const TEST_ORG_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

describe('V1 Reclaim Home Organization', function () {
  this.timeout(300000);

  let assertStoreIsOwnedStub;

  before(async function () {
    await pullPickListValues();
    await prepareDb();
  });

  beforeEach(async function () {
    await Organization.destroy({ where: {} });
    if (assertStoreIsOwnedStub) {
      assertStoreIsOwnedStub.restore();
      assertStoreIsOwnedStub = null;
    }
  });

  afterEach(function () {
    if (assertStoreIsOwnedStub) {
      assertStoreIsOwnedStub.restore();
      assertStoreIsOwnedStub = null;
    }
  });

  describe('Validation and pre-ownership checks', function () {
    it('should return 404 when orgUid does not exist', async function () {
      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'non-existent-org-uid' })
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('not found');
    });

    it('should return 200 idempotently when org is already home', async function () {
      await Organization.create({
        orgUid: 'test-already-home',
        name: 'Already Home Org',
        icon: 'icon',
        isHome: true,
        subscribed: true,
        registryId: 'reg-1',
        dataModelVersionStoreId: 'dmv-1',
        fileStoreId: 'fs-1',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'test-already-home' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('already the home organization');
    });

    it('should return 409 when another org is already home', async function () {
      await Organization.create({
        orgUid: 'existing-home-org',
        name: 'Existing Home',
        icon: 'icon',
        isHome: true,
        subscribed: true,
        registryId: 'reg-home',
        dataModelVersionStoreId: 'dmv-home',
        fileStoreId: 'fs-home',
        orgHash: TEST_ORG_HASH,
      });

      await Organization.create({
        orgUid: 'orphan-non-home',
        name: 'Orphan Non-Home',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-2',
        dataModelVersionStoreId: 'dmv-2',
        fileStoreId: 'fs-2',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'orphan-non-home' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('existing-home-org');
      expect(response.body.message).to.include('already set as home');
    });

    it('should return 409 when a PENDING org creation is in progress', async function () {
      await Organization.create({
        orgUid: 'PENDING',
        name: 'Pending Org',
        icon: 'icon',
        isHome: true,
        subscribed: false,
      });

      await Organization.create({
        orgUid: 'orphan-pending-test',
        name: 'Orphan Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-3',
        dataModelVersionStoreId: 'dmv-3',
        fileStoreId: 'fs-3',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'orphan-pending-test' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(
        response.body.message.includes('creation is currently in progress')
          || response.body.message.includes('already set as home'),
      ).to.be.true;
    });

    it('should return 400 when orgUid is missing from request body', async function () {
      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({})
        .expect(400);

      expect(response.body.errors || response.body.success === false).to.be.ok;
    });
  });

  describe('Store ownership checks', function () {
    it('should fail when org store is not owned', async function () {
      await Organization.create({
        orgUid: 'not-owned-org',
        name: 'Not Owned Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-notowned',
        dataModelVersionStoreId: 'dmv-notowned',
        fileStoreId: 'fs-notowned',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'not-owned-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('not owned by this chia wallet');
    });
  });

  describe('Data integrity checks (with ownership stubbed)', function () {
    beforeEach(function () {
      assertStoreIsOwnedStub = sinon.stub(dataAssertions, 'assertStoreIsOwned').resolves();
    });

    it('should return 400 when orgHash is not populated', async function () {
      await Organization.create({
        orgUid: 'no-hash-org',
        name: 'No Hash Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-nohash',
        dataModelVersionStoreId: 'dmv-nohash',
        fileStoreId: 'fs-nohash',
        orgHash: '0',
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'no-hash-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('orgHash is not populated');
    });

    it('should return 400 when orgHash is null hash', async function () {
      const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

      await Organization.create({
        orgUid: 'null-hash-org',
        name: 'Null Hash Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-nullhash',
        dataModelVersionStoreId: 'dmv-nullhash',
        fileStoreId: 'fs-nullhash',
        orgHash: nullHash,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'null-hash-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('orgHash is not populated');
    });

    it('should return 400 when registryId is missing', async function () {
      await Organization.create({
        orgUid: 'no-registry-org',
        name: 'No Registry Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: null,
        dataModelVersionStoreId: 'dmv-noreg',
        fileStoreId: 'fs-noreg',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'no-registry-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('missing registryId');
    });

    it('should return 400 when dataModelVersionStoreId is missing', async function () {
      await Organization.create({
        orgUid: 'no-dmv-org',
        name: 'No DMV Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-nodmv',
        dataModelVersionStoreId: null,
        fileStoreId: 'fs-nodmv',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'no-dmv-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('missing dataModelVersionStoreId');
    });

    it('should return 400 when singleton has no v1 key', async function () {
      const singletonStoreId = 'singleton-no-v1-key';

      await datalayer.syncDataLayer(singletonStoreId, { v2: 'some-registry' });

      await Organization.create({
        orgUid: 'no-v1-key-org',
        name: 'No V1 Key Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'reg-nov1',
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-nov1',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'no-v1-key-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('does not contain a v1 key');
    });

    it('should return 400 when singleton v1 registry does not match org registryId', async function () {
      const singletonStoreId = 'singleton-mismatch';

      await datalayer.syncDataLayer(singletonStoreId, { v1: 'wrong-registry-id' });

      await Organization.create({
        orgUid: 'mismatch-org',
        name: 'Mismatch Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: 'correct-registry-id',
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-mismatch',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'mismatch-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('does not match');
      expect(response.body.message).to.include('wrong-registry-id');
      expect(response.body.message).to.include('correct-registry-id');
    });

    it('should successfully reclaim org as home when all checks pass', async function () {
      const singletonStoreId = 'singleton-happy-path';
      const registryId = 'registry-happy-path';

      await datalayer.syncDataLayer(singletonStoreId, { v1: registryId });

      await Organization.create({
        orgUid: 'reclaim-happy-org',
        name: 'Reclaim Happy Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: registryId,
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-happy',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'reclaim-happy-org' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('reclaimed as the home organization');

      const updatedOrg = await Organization.findOne({
        where: { orgUid: 'reclaim-happy-org' },
        raw: true,
      });

      expect(updatedOrg.isHome).to.be.ok;
    });

    it('should verify assertStoreIsOwned was called for all three stores', async function () {
      const singletonStoreId = 'singleton-ownership-check';
      const registryId = 'registry-ownership-check';

      await datalayer.syncDataLayer(singletonStoreId, { v1: registryId });

      await Organization.create({
        orgUid: 'ownership-check-org',
        name: 'Ownership Check Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId: registryId,
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-ownership',
        orgHash: TEST_ORG_HASH,
      });

      await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid: 'ownership-check-org' })
        .expect(200);

      expect(assertStoreIsOwnedStub.callCount).to.equal(3);
      expect(assertStoreIsOwnedStub.calledWith('ownership-check-org')).to.be.true;
      expect(assertStoreIsOwnedStub.calledWith(registryId)).to.be.true;
      expect(assertStoreIsOwnedStub.calledWith(singletonStoreId)).to.be.true;
    });
  });
});
