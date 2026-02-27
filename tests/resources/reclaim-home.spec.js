import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { prepareDb } from '../../src/database';
import { pullPickListValues } from '../../src/utils/data-loaders';
import datalayer from '../../src/datalayer';
import { getConfig } from '../../src/utils/config-loader.js';

const { USE_SIMULATOR } = getConfig().APP;

const TEST_ORG_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

describe('V1 Reclaim Home Organization', function () {
  this.timeout(300000);

  before(async function () {
    await pullPickListValues();
    await prepareDb();
  });

  beforeEach(async function () {
    await Organization.destroy({ where: {} });
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
        isHome: false,
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
      expect(response.body.message).to.include('creation is currently in progress');
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

  describe('Data integrity checks', function () {
    it('should return 400 when orgHash is not populated', async function () {
      const orgUid = 'no-hash-org';
      const registryId = 'reg-nohash';
      const singletonStoreId = 'dmv-nohash';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { test: 'data' });

      await Organization.create({
        orgUid,
        name: 'No Hash Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId,
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-nohash',
        orgHash: '0',
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('orgHash is not populated');
    });

    it('should return 400 when orgHash is null hash', async function () {
      const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const orgUid = 'null-hash-org';
      const registryId = 'reg-nullhash';
      const singletonStoreId = 'dmv-nullhash';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { test: 'data' });

      await Organization.create({
        orgUid,
        name: 'Null Hash Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId,
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-nullhash',
        orgHash: nullHash,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('orgHash is not populated');
    });

    it('should return 400 when registryId is missing', async function () {
      const orgUid = 'no-registry-org';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });

      await Organization.create({
        orgUid,
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
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('missing registryId');
    });

    it('should return 400 when dataModelVersionStoreId is missing', async function () {
      const orgUid = 'no-dmv-org';
      const registryId = 'reg-nodmv';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });

      await Organization.create({
        orgUid,
        name: 'No DMV Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId,
        dataModelVersionStoreId: null,
        fileStoreId: 'fs-nodmv',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('missing dataModelVersionStoreId');
    });

    it('should return 400 when singleton has no v1 key', async function () {
      const singletonStoreId = 'singleton-no-v1-key';
      const registryId = 'reg-nov1';
      const orgUid = 'no-v1-key-org';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v2: 'some-registry' });

      await Organization.create({
        orgUid,
        name: 'No V1 Key Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId,
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-nov1',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('does not contain a v1 key');
    });

    it('should return 400 when singleton v1 registry does not match org registryId', async function () {
      const singletonStoreId = 'singleton-mismatch';
      const orgUid = 'mismatch-org';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer('correct-registry-id', { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v1: 'wrong-registry-id' });

      await Organization.create({
        orgUid,
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
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('does not match');
      expect(response.body.message).to.include('wrong-registry-id');
      expect(response.body.message).to.include('correct-registry-id');
    });

    it('should successfully reclaim org as home when all checks pass', async function () {
      const singletonStoreId = 'singleton-happy-path';
      const registryId = 'registry-happy-path';
      const orgUid = 'reclaim-happy-org';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v1: registryId });

      await Organization.create({
        orgUid,
        name: 'Reclaim Happy Org',
        icon: 'icon',
        isHome: false,
        subscribed: true,
        registryId,
        dataModelVersionStoreId: singletonStoreId,
        fileStoreId: 'fs-happy',
        orgHash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v1/organizations/reclaim-home')
        .send({ orgUid })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('reclaimed as the home organization');

      const updatedOrg = await Organization.findOne({
        where: { orgUid },
        raw: true,
      });

      expect(updatedOrg.isHome).to.be.ok;
    });

    it('should allow only one home org under concurrent reclaim requests', async function () {
      const orgOneUid = 'concurrent-org-one';
      const orgTwoUid = 'concurrent-org-two';
      const orgOneRegistry = 'concurrent-registry-one';
      const orgTwoRegistry = 'concurrent-registry-two';
      const orgOneSingleton = 'concurrent-singleton-one';
      const orgTwoSingleton = 'concurrent-singleton-two';

      await Promise.all([
        datalayer.syncDataLayer(orgOneUid, { test: 'data' }),
        datalayer.syncDataLayer(orgTwoUid, { test: 'data' }),
        datalayer.syncDataLayer(orgOneRegistry, { test: 'data' }),
        datalayer.syncDataLayer(orgTwoRegistry, { test: 'data' }),
        datalayer.syncDataLayer(orgOneSingleton, { v1: orgOneRegistry }),
        datalayer.syncDataLayer(orgTwoSingleton, { v1: orgTwoRegistry }),
      ]);

      await Organization.bulkCreate([
        {
          orgUid: orgOneUid,
          name: 'Concurrent Org One',
          icon: 'icon',
          isHome: false,
          subscribed: true,
          registryId: orgOneRegistry,
          dataModelVersionStoreId: orgOneSingleton,
          fileStoreId: 'fs-concurrent-one',
          orgHash: TEST_ORG_HASH,
        },
        {
          orgUid: orgTwoUid,
          name: 'Concurrent Org Two',
          icon: 'icon',
          isHome: false,
          subscribed: true,
          registryId: orgTwoRegistry,
          dataModelVersionStoreId: orgTwoSingleton,
          fileStoreId: 'fs-concurrent-two',
          orgHash: TEST_ORG_HASH,
        },
      ]);

      const [firstResponse, secondResponse] = await Promise.all([
        supertest(app).post('/v1/organizations/reclaim-home').send({ orgUid: orgOneUid }),
        supertest(app).post('/v1/organizations/reclaim-home').send({ orgUid: orgTwoUid }),
      ]);

      const statusCodes = [firstResponse.status, secondResponse.status].sort();
      expect(statusCodes[0]).to.equal(200);
      expect([400, 409]).to.include(statusCodes[1]);

      const homeOrgs = await Organization.findAll({
        where: { isHome: true },
        raw: true,
      });

      expect(homeOrgs).to.have.lengthOf(1);
      expect([orgOneUid, orgTwoUid]).to.include(homeOrgs[0].orgUid);
    });
  });
});
