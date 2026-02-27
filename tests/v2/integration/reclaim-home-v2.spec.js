import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import datalayer from '../../../src/datalayer/index.js';
import { getConfig } from '../../../src/utils/config-loader.js';

const { USE_SIMULATOR } = getConfig().APP;

const TEST_ORG_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

describe('V2 Reclaim Home Organization', function () {
  this.timeout(300000);

  before(async function () {
    await prepareV2Db();
  });

  beforeEach(async function () {
    await OrganizationsV2.destroy({ where: {} });
  });

  describe('Validation and pre-ownership checks', function () {
    it('should return 404 when orgUid does not exist', async function () {
      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: '11111111-1111-4111-8111-111111111111' })
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('not found');
    });

    it('should return 200 idempotently when org is already home', async function () {
      await OrganizationsV2.create({
        org_uid: '22222222-2222-4222-8222-222222222222',
        name: 'Already Home Org',
        icon: 'icon',
        is_home: true,
        subscribed: true,
        registry_id: 'reg-1',
        data_model_version_store_id: 'dmv-1',
        file_store_subscribed: 'fs-1',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: '22222222-2222-4222-8222-222222222222' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('already the home organization');
    });

    it('should return 409 when another org is already home', async function () {
      await OrganizationsV2.create({
        org_uid: '33333333-3333-4333-8333-333333333333',
        name: 'Existing Home',
        icon: 'icon',
        is_home: true,
        subscribed: true,
        registry_id: 'reg-home',
        data_model_version_store_id: 'dmv-home',
        file_store_subscribed: 'fs-home',
        org_hash: TEST_ORG_HASH,
      });

      await OrganizationsV2.create({
        org_uid: '44444444-4444-4444-8444-444444444444',
        name: 'Orphan Non-Home',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: 'reg-2',
        data_model_version_store_id: 'dmv-2',
        file_store_subscribed: 'fs-2',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: '44444444-4444-4444-8444-444444444444' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('33333333-3333-4333-8333-333333333333');
      expect(response.body.message).to.include('already set as home');
    });

    it('should return 409 when a PENDING org creation is in progress', async function () {
      await OrganizationsV2.create({
        org_uid: 'PENDING',
        name: 'Pending Org',
        icon: 'icon',
        is_home: false,
        subscribed: false,
      });

      await OrganizationsV2.create({
        org_uid: '55555555-5555-4555-8555-555555555555',
        name: 'Orphan Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: 'reg-3',
        data_model_version_store_id: 'dmv-3',
        file_store_subscribed: 'fs-3',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: '55555555-5555-4555-8555-555555555555' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('creation is currently in progress');
    });

    it('should return 400 when orgUid is missing from request body', async function () {
      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({})
        .expect(400);

      expect(response.body.errors || response.body.success === false).to.be.ok;
    });
  });

  describe('Store ownership checks', function () {
    it('should fail when org store is not owned (no data in simulator)', async function () {
      await OrganizationsV2.create({
        org_uid: '66666666-6666-4666-8666-666666666666',
        name: 'Not Owned Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: 'reg-notowned',
        data_model_version_store_id: 'dmv-notowned',
        file_store_subscribed: 'fs-notowned',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid: '66666666-6666-4666-8666-666666666666' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('not owned by this chia wallet');
    });
  });

  describe('Data integrity checks', function () {
    it('should return 400 when org_hash is not populated', async function () {
      const singletonStoreId = 'v2-singleton-nohash';
      const registryId = 'v2-registry-nohash';
      const orgUid = '77777777-7777-4777-8777-777777777777';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v2: registryId });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'No Hash Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: registryId,
        data_model_version_store_id: singletonStoreId,
        file_store_subscribed: 'fs-nohash',
        org_hash: '0',
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('org_hash is not populated');
    });

    it('should return 400 when org_hash is null hash', async function () {
      const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const singletonStoreId = 'v2-singleton-nullhash';
      const registryId = 'v2-registry-nullhash';
      const orgUid = '88888888-8888-4888-8888-888888888888';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v2: registryId });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'Null Hash Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: registryId,
        data_model_version_store_id: singletonStoreId,
        file_store_subscribed: 'fs-nullhash',
        org_hash: nullHash,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('org_hash is not populated');
    });

    it('should return 400 when registry_id is missing', async function () {
      const orgUid = '99999999-9999-4999-8999-999999999999';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'No Registry Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: null,
        data_model_version_store_id: 'dmv-noreg',
        file_store_subscribed: 'fs-noreg',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('missing registry_id');
    });

    it('should return 400 when data_model_version_store_id is missing', async function () {
      const orgUid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const registryId = 'v2-registry-nodmv';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'No DMV Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: registryId,
        data_model_version_store_id: null,
        file_store_subscribed: 'fs-nodmv',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('missing data_model_version_store_id');
    });

    it('should return 400 when singleton has no v2 key', async function () {
      const singletonStoreId = 'v2-singleton-nov2key';
      const registryId = 'v2-registry-nov2key';
      const orgUid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v1: 'some-registry' });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'No V2 Key Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: registryId,
        data_model_version_store_id: singletonStoreId,
        file_store_subscribed: 'fs-nov2',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('does not contain a v2 key');
    });

    it('should return 400 when singleton v2 registry does not match org registry_id', async function () {
      const singletonStoreId = 'v2-singleton-mismatch';
      const orgUid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer('correct-registry-id', { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v2: 'wrong-registry-id' });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'Mismatch Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: 'correct-registry-id',
        data_model_version_store_id: singletonStoreId,
        file_store_subscribed: 'fs-mismatch',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('does not match');
      expect(response.body.message).to.include('wrong-registry-id');
      expect(response.body.message).to.include('correct-registry-id');
    });

    it('should allow only one home org under concurrent reclaim requests', async function () {
      const orgOneUid = 'f1111111-1111-4111-8111-111111111111';
      const orgTwoUid = 'f2222222-2222-4222-8222-222222222222';
      const orgOneRegistry = 'v2-concurrent-registry-one';
      const orgTwoRegistry = 'v2-concurrent-registry-two';
      const orgOneSingleton = 'v2-concurrent-singleton-one';
      const orgTwoSingleton = 'v2-concurrent-singleton-two';

      await Promise.all([
        datalayer.syncDataLayer(orgOneUid, { test: 'data' }),
        datalayer.syncDataLayer(orgTwoUid, { test: 'data' }),
        datalayer.syncDataLayer(orgOneRegistry, { test: 'data' }),
        datalayer.syncDataLayer(orgTwoRegistry, { test: 'data' }),
        datalayer.syncDataLayer(orgOneSingleton, { v2: orgOneRegistry }),
        datalayer.syncDataLayer(orgTwoSingleton, { v2: orgTwoRegistry }),
      ]);

      await OrganizationsV2.bulkCreate([
        {
          org_uid: orgOneUid,
          name: 'V2 Concurrent Org One',
          icon: 'icon',
          is_home: false,
          subscribed: true,
          registry_id: orgOneRegistry,
          data_model_version_store_id: orgOneSingleton,
          file_store_subscribed: 'fs-concurrent-one',
          org_hash: TEST_ORG_HASH,
        },
        {
          org_uid: orgTwoUid,
          name: 'V2 Concurrent Org Two',
          icon: 'icon',
          is_home: false,
          subscribed: true,
          registry_id: orgTwoRegistry,
          data_model_version_store_id: orgTwoSingleton,
          file_store_subscribed: 'fs-concurrent-two',
          org_hash: TEST_ORG_HASH,
        },
      ]);

      const [firstResponse, secondResponse] = await Promise.all([
        supertest(app).post('/v2/organizations/reclaim-home').send({ orgUid: orgOneUid }),
        supertest(app).post('/v2/organizations/reclaim-home').send({ orgUid: orgTwoUid }),
      ]);

      const statusCodes = [firstResponse.status, secondResponse.status].sort();
      expect(statusCodes[0]).to.equal(200);
      expect([400, 409]).to.include(statusCodes[1]);

      const homeOrgs = await OrganizationsV2.findAll({
        where: { is_home: true },
        raw: true,
      });

      expect(homeOrgs).to.have.lengthOf(1);
      expect([orgOneUid, orgTwoUid]).to.include(homeOrgs[0].org_uid);
    });

    it('should successfully reclaim org as home when all checks pass', async function () {
      const singletonStoreId = 'v2-singleton-happy';
      const registryId = 'v2-registry-happy';
      const orgUid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

      await datalayer.syncDataLayer(orgUid, { test: 'data' });
      await datalayer.syncDataLayer(registryId, { test: 'data' });
      await datalayer.syncDataLayer(singletonStoreId, { v2: registryId });

      await OrganizationsV2.create({
        org_uid: orgUid,
        name: 'Reclaim Happy Org',
        icon: 'icon',
        is_home: false,
        subscribed: true,
        registry_id: registryId,
        data_model_version_store_id: singletonStoreId,
        file_store_subscribed: 'fs-happy',
        org_hash: TEST_ORG_HASH,
      });

      const response = await supertest(app)
        .post('/v2/organizations/reclaim-home')
        .send({ orgUid })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('reclaimed as the home organization');

      const updatedOrg = await OrganizationsV2.findOne({
        where: { org_uid: orgUid },
        raw: true,
      });

      expect(updatedOrg.is_home).to.be.ok;
      expect(updatedOrg.is_home).to.equal(1);
    });
  });
});
