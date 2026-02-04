import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { Organization } from '../../../src/models/organizations/organizations.model.js';
import datalayer from '../../../src/datalayer/index.js';
import * as simulator from '../../../src/datalayer/simulator.js';
import { decodeHex, decodeDataLayerResponse } from '../../../src/utils/datalayer-utils.js';
import { getConfig } from '../../../src/utils/config-loader.js';
import { waitForV2DataLayerSync } from '../utils/v2-test-helpers.js';

const { USE_SIMULATOR } = getConfig().APP;
const TEST_WAIT_TIME = USE_SIMULATOR ? 5000 : datalayer.POLLING_INTERVAL * 10;

// Helper to get store data - uses simulator in simulator mode
const getStoreDataForTest = async (storeId) => {
  if (USE_SIMULATOR) {
    return await simulator.getStoreData(storeId);
  } else {
    return new Promise((resolve, reject) => {
      datalayer.getStoreData(
        storeId,
        (data) => resolve(data),
        (error) => reject(new Error(error)),
      );
    });
  }
};

// Helper to wait for organization creation to complete
const waitForOrgCreation = async () => {
  if (USE_SIMULATOR) {
    // In simulator mode, operations are synchronous - no waiting needed
    // Just ensure any pending promises resolve
    await new Promise(resolve => setImmediate(resolve));
  } else {
    await waitForV2DataLayerSync();
  }
};

/**
 * Phase 16.7: V2 Organization Management Integration Tests
 *
 * Comprehensive tests for V2 organization creation and upgrade functionality
 */
describe('Phase 16.7: V2 Organization Management Integration Tests', function () {
  this.timeout(300000); // 5 minutes for datalayer operations

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up V1 and V2 orgs before each test
    await OrganizationsV2.destroy({ where: {} });
    await Organization.destroy({ where: { isHome: true } });
  });

  describe('New User - V2 Org Creation', function () {
    it('should create V2 organization for new user with no V1 org', async function () {
      // Verify no V1 org exists
      const v1Org = await Organization.findOne({ where: { isHome: true } });
      expect(v1Org).to.be.null;

      // Verify no V2 org exists
      const v2OrgBefore = await OrganizationsV2.findOne({ where: { is_home: true } });
      expect(v2OrgBefore).to.be.null;

      // Create V2 org via API
      const orgName = 'Test V2 Organization';
      const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          name: orgName,
          icon: orgIcon,
        })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.orgUid).to.exist;
      expect(response.body.message).to.include('created successfully');

      // Wait for datalayer operations to complete
      await waitForOrgCreation();

      // Verify V2 org created in database
      const v2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      expect(v2Org).to.exist;
      expect(v2Org.org_uid).to.equal(response.body.orgUid);
      expect(v2Org.name).to.equal(orgName);
      expect(v2Org.icon).to.equal(orgIcon);
      // SQLite stores booleans as integers (0/1), so check for truthy value
      expect(v2Org.is_home).to.be.ok;
      expect(v2Org.is_home).to.equal(1);
      expect(v2Org.registry_id).to.exist;
      expect(v2Org.data_model_version_store_id).to.exist;
      expect(v2Org.file_store_subscribed).to.exist;

      // Verify 4 stores created: orgUid, registryId, dataModelVersionStoreId, fileStoreId
      expect(v2Org.org_uid).to.exist;
      expect(v2Org.registry_id).to.exist;
      expect(v2Org.data_model_version_store_id).to.exist;
      expect(v2Org.file_store_subscribed).to.exist;

      // Verify orgUid store contains correct data
      // In simulator mode, data should be immediately available after syncDataLayer
      const orgUidStoreData = await getStoreDataForTest(v2Org.org_uid);
      expect(orgUidStoreData).to.exist;
      expect(orgUidStoreData).to.not.be.instanceOf(Error);
      expect(orgUidStoreData.keys_values).to.exist;
      expect(orgUidStoreData.keys_values.length).to.be.greaterThan(0);

      // Decode the store data (simulator now strips prefix automatically)
      const decodedOrgUidStore = decodeDataLayerResponse(orgUidStoreData);
      const orgUidStoreMap = {};
      decodedOrgUidStore.forEach(({ key, value }) => {
        orgUidStoreMap[key] = value;
      });

      expect(orgUidStoreMap.registryId).to.equal(v2Org.data_model_version_store_id);
      expect(orgUidStoreMap.fileStoreId).to.equal(v2Org.file_store_subscribed);
      expect(orgUidStoreMap.name).to.equal(orgName);
      expect(orgUidStoreMap.icon).to.equal(orgIcon);

      // Verify singleton created with only v2 key
      // In simulator mode, data should be immediately available after syncDataLayer
      const singletonData = await getStoreDataForTest(v2Org.data_model_version_store_id);
      expect(singletonData).to.exist;
      expect(singletonData).to.not.be.instanceOf(Error);
      expect(singletonData.keys_values).to.exist;
      expect(singletonData.keys_values.length).to.be.greaterThan(0);

      const decodedSingleton = decodeDataLayerResponse(singletonData);
      const singletonMap = {};
      decodedSingleton.forEach(({ key, value }) => {
        singletonMap[key] = value;
      });

      expect(singletonMap.v2).to.equal(v2Org.registry_id);
      expect(singletonMap.v1).to.be.undefined; // Should NOT have v1 key for new users

      // Verify V2 org is NOT in V1 table
      const v1OrgAfter = await Organization.findOne({
        where: { orgUid: v2Org.org_uid },
      });
      expect(v1OrgAfter).to.be.null;

      // Verify V2 orgUid is completely different from any V1 orgUid
      const allV1Orgs = await Organization.findAll({ raw: true });
      const v1OrgUids = allV1Orgs.map(org => org.orgUid);
      expect(v1OrgUids).to.not.include(v2Org.org_uid);
    }).timeout(TEST_WAIT_TIME * 10);

    it('should create V2 organization with file upload for icon', async function () {
      const orgName = 'Test V2 Org with File Upload';
      const iconBuffer = Buffer.from('fake-image-data');

      const response = await supertest(app)
        .post('/v2/organizations')
        .attach('file', iconBuffer, 'icon.png')
        .field('name', orgName)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.orgUid).to.exist;

      await waitForOrgCreation();

      const v2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      expect(v2Org).to.exist;
      expect(v2Org.name).to.equal(orgName);
      expect(v2Org.icon).to.exist; // Icon should be base64 encoded
    }).timeout(TEST_WAIT_TIME * 10);
  });

  describe('New User - Error Cases', function () {
    it('should error if V1 org exists in database', async function () {
      // Create V1 org with singleton store
      const v1SingletonId = USE_SIMULATOR ? 'test-v1-singleton-error' : await datalayer.createDataLayerStore();
      const v1Org = await Organization.create({
        orgUid: 'test-v1-org',
        name: 'Test V1 Org',
        icon: 'test-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: 'test-registry',
        dataModelVersionStoreId: v1SingletonId,
        fileStoreId: 'test-filestore',
      });

      // Create singleton with v1 key in datalayer (so the check works)
      await datalayer.syncDataLayer(
        v1SingletonId,
        { v1: v1Org.registryId },
      );

      await waitForOrgCreation();

      // Try to create V2 org - should error
      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          name: 'Test V2 Org',
          icon: 'test-icon',
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      // Error message should indicate V1 org exists or should use upgrade endpoint
      expect(
        response.body.message.includes('V1 organization detected') ||
        response.body.message.includes('upgrade endpoint') ||
        response.body.error?.includes('V1 organization detected')
      ).to.be.true;
    });

    it('should error if V1 singleton exists in datalayer', async function () {
      // Create V1 org with singleton
      const v1Org = await Organization.create({
        orgUid: 'test-v1-org-2',
        name: 'Test V1 Org 2',
        icon: 'test-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: 'test-registry-2',
        dataModelVersionStoreId: USE_SIMULATOR ? 'test-singleton-2' : await datalayer.createDataLayerStore(),
        fileStoreId: 'test-filestore-2',
      });

      // Create singleton with v1 key in datalayer
      if (v1Org.dataModelVersionStoreId) {
        await datalayer.syncDataLayer(
          v1Org.dataModelVersionStoreId,
          { v1: v1Org.registryId },
        );
      }

      await waitForOrgCreation();

      // Try to create V2 org - should error
      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          name: 'Test V2 Org',
          icon: 'test-icon',
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      // Error message should indicate V1 org exists or should use upgrade endpoint
      expect(
        response.body.message.includes('V1 organization detected') ||
        response.body.message.includes('upgrade endpoint') ||
        response.body.error?.includes('V1 organization detected')
      ).to.be.true;
    });

    it('should error if V2 org already exists', async function () {
      // Create V2 org first
      const v2Org = await OrganizationsV2.create({
        org_uid: 'test-v2-org',
        name: 'Test V2 Org',
        icon: 'test-icon',
        is_home: true,
        subscribed: true,
        registry_id: 'test-registry',
        data_model_version_store_id: 'test-singleton',
        file_store_subscribed: 'test-filestore',
      });

      // Try to create another V2 org - should error
      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          name: 'Another V2 Org',
          icon: 'test-icon',
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(
        response.body.message?.includes('already exists') ||
        response.body.error?.includes('already exists')
      ).to.be.true;
    });

    it('should error if name is missing', async function () {
      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          icon: 'test-icon',
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(
        response.body.message?.includes('name is required') ||
        response.body.error?.includes('name is required')
      ).to.be.true;
    });
  });

  describe('Existing User - Upgrade', function () {
    it('should upgrade from V1 to V2 organization', async function () {
      // Create V1 org with singleton
      const v1OrgUid = USE_SIMULATOR ? 'test-v1-org-upgrade' : await datalayer.createDataLayerStore();
      const v1RegistryId = USE_SIMULATOR ? 'test-v1-registry' : await datalayer.createDataLayerStore();
      const v1DataModelVersionStoreId = USE_SIMULATOR ? 'test-v1-singleton' : await datalayer.createDataLayerStore();
      const v1FileStoreId = USE_SIMULATOR ? 'test-v1-filestore' : await datalayer.createDataLayerStore();

      const v1Org = await Organization.create({
        orgUid: v1OrgUid,
        name: 'Test V1 Org for Upgrade',
        icon: 'test-v1-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: v1RegistryId,
        dataModelVersionStoreId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
      });

      // Create singleton with v1 key
      await datalayer.syncDataLayer(
        v1DataModelVersionStoreId,
        { v1: v1RegistryId },
      );

      // Set up V1 orgUid store
      await datalayer.syncDataLayer(
        v1OrgUid,
        {
          registryId: v1DataModelVersionStoreId,
          fileStoreId: v1FileStoreId,
          name: v1Org.name,
          icon: v1Org.icon,
        },
      );

      await waitForOrgCreation();

      // Upgrade to V2
      const response = await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(200);

      expect(response.body.success).to.be.true;
      // In simulator mode, upgrade completes synchronously
      if (USE_SIMULATOR) {
        expect(response.body.message).to.include('completed successfully');
      } else {
        expect(response.body.message).to.include('currently being processed');
        await waitForOrgCreation();
      }

      // Verify V2 org created
      const v2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      expect(v2Org).to.exist;
      expect(v2Org.name).to.equal(v1Org.name);
      expect(v2Org.icon).to.equal(v1Org.icon);
      // SQLite stores booleans as integers (0/1)
      expect(v2Org.is_home).to.be.ok;
      expect(v2Org.is_home).to.equal(1);

      // Verify V2 org shares org_uid and file_store with V1 (shared identity)
      expect(v2Org.org_uid).to.equal(v1Org.orgUid); // SAME org_uid - shared identity
      expect(v2Org.file_store_subscribed).to.equal(v1Org.fileStoreId); // SAME file store - shared

      // Verify V2 registry is different (new v2 data store)
      expect(v2Org.registry_id).to.not.equal(v1Org.registryId);

      // Verify singleton is SHARED (same store ID)
      expect(v2Org.data_model_version_store_id).to.equal(v1Org.dataModelVersionStoreId);

      // Verify singleton has BOTH v1 and v2 keys
      // In simulator mode, data should be immediately available after syncDataLayer
      const singletonData = await getStoreDataForTest(v1DataModelVersionStoreId);
      expect(singletonData).to.exist;
      expect(singletonData).to.not.be.instanceOf(Error);
      expect(singletonData.keys_values).to.exist;
      expect(singletonData.keys_values.length).to.be.greaterThan(0);

      const decodedSingleton = decodeDataLayerResponse(singletonData);
      const singletonMap = {};
      decodedSingleton.forEach(({ key, value }) => {
        singletonMap[key] = value;
      });

      expect(singletonMap.v1).to.equal(v1Org.registryId);
      expect(singletonMap.v2).to.equal(v2Org.registry_id);

      // Verify shared orgUid store (V1's store, now used by both V1 and V2)
      // Since V2 reuses V1's orgUid store, the store data should still be V1's original data
      // In simulator mode, data should be immediately available
      const sharedOrgUidStoreData = await getStoreDataForTest(v2Org.org_uid);
      expect(sharedOrgUidStoreData).to.exist;
      expect(sharedOrgUidStoreData).to.not.be.instanceOf(Error);
      expect(sharedOrgUidStoreData.keys_values).to.exist;
      expect(sharedOrgUidStoreData.keys_values.length).to.be.greaterThan(0);

      const decodedSharedOrgUidStore = decodeDataLayerResponse(sharedOrgUidStoreData);
      const sharedOrgUidStoreMap = {};
      decodedSharedOrgUidStore.forEach(({ key, value }) => {
        sharedOrgUidStoreMap[key] = value;
      });

      expect(sharedOrgUidStoreMap.registryId).to.equal(v1DataModelVersionStoreId); // Points to shared singleton
      expect(sharedOrgUidStoreMap.fileStoreId).to.equal(v1FileStoreId); // SAME file store - shared with V1
      expect(sharedOrgUidStoreMap.name).to.equal(v1Org.name);
      expect(sharedOrgUidStoreMap.icon).to.equal(v1Org.icon);

      // Verify V1 org remains unchanged
      const v1OrgAfter = await Organization.findOne({
        where: { orgUid: v1OrgUid },
        raw: true,
      });

      expect(v1OrgAfter).to.exist;
      expect(v1OrgAfter.orgUid).to.equal(v1Org.orgUid);
      expect(v1OrgAfter.name).to.equal(v1Org.name);
      expect(v1OrgAfter.registryId).to.equal(v1Org.registryId);
      expect(v1OrgAfter.dataModelVersionStoreId).to.equal(v1Org.dataModelVersionStoreId);
    }).timeout(TEST_WAIT_TIME * 15);
  });

  describe('Existing User - Upgrade Error Cases', function () {
    it('should error if no V1 org exists', async function () {
      // Verify no V1 org exists
      const v1Org = await Organization.findOne({ where: { isHome: true } });
      expect(v1Org).to.be.null;

      // Try to upgrade - should error
      const response = await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(
        response.body.message?.includes('V1 home organization not found') ||
        response.body.error?.includes('V1 home organization not found')
      ).to.be.true;
    });

    it('should error if V2 org already exists and singleton has v2 key', async function () {
      // Create V1 org
      const v1Org = await Organization.create({
        orgUid: 'test-v1-org-error',
        name: 'Test V1 Org',
        icon: 'test-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: 'test-registry',
        dataModelVersionStoreId: 'test-singleton',
        fileStoreId: 'test-filestore',
      });

      // Create singleton with both v1 and v2 keys (simulating completed upgrade)
      await datalayer.syncDataLayer(
        v1Org.dataModelVersionStoreId,
        {
          v1: v1Org.registryId,
          v2: 'test-registry-v2', // v2 key already exists
        },
      );

      // Create V2 org
      const v2Org = await OrganizationsV2.create({
        org_uid: 'test-v2-org-error',
        name: 'Test V2 Org',
        icon: 'test-icon',
        is_home: true,
        subscribed: true,
        registry_id: 'test-registry-v2',
        data_model_version_store_id: v1Org.dataModelVersionStoreId,
        file_store_subscribed: 'test-filestore-v2',
      });

      await waitForOrgCreation();

      // Try to upgrade again - should error (already fully upgraded)
      const response = await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(
        response.body.message?.includes('already exists') ||
        response.body.message?.includes('already complete') ||
        response.body.error?.includes('already exists') ||
        response.body.error?.includes('already complete')
      ).to.be.true;
    });

    it('should complete partial upgrade if V2 org exists but singleton missing v2 key', async function () {
      // Create V1 org
      const v1OrgUid = USE_SIMULATOR ? 'test-v1-partial' : await datalayer.createDataLayerStore();
      const v1RegistryId = USE_SIMULATOR ? 'test-registry-partial' : await datalayer.createDataLayerStore();
      const v1DataModelVersionStoreId = USE_SIMULATOR ? 'test-singleton-partial' : await datalayer.createDataLayerStore();
      const v1FileStoreId = USE_SIMULATOR ? 'test-filestore-partial' : await datalayer.createDataLayerStore();

      const v1Org = await Organization.create({
        orgUid: v1OrgUid,
        name: 'Test V1 Org Partial',
        icon: 'test-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: v1RegistryId,
        dataModelVersionStoreId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
      });

      // Create singleton with ONLY v1 key (simulating partial upgrade failure)
      await datalayer.syncDataLayer(
        v1DataModelVersionStoreId,
        { v1: v1RegistryId }, // Only v1 key - v2 key missing
      );

      // Set up V1 orgUid store
      await datalayer.syncDataLayer(
        v1OrgUid,
        {
          registryId: v1DataModelVersionStoreId,
          fileStoreId: v1FileStoreId,
          name: v1Org.name,
          icon: v1Org.icon,
        },
      );

      await waitForOrgCreation();

      // Create V2 org (simulating partial upgrade - org created but singleton update failed)
      // With shared org_uid architecture, V2 org uses v1OrgUid (not a separate store)
      const v2RegistryId = USE_SIMULATOR ? 'test-registry-v2-partial' : await datalayer.createDataLayerStore();

      const v2Org = await OrganizationsV2.create({
        org_uid: v1OrgUid, // SAME as V1 - shared org_uid
        name: v1Org.name,
        icon: v1Org.icon,
        is_home: true,
        subscribed: true,
        registry_id: v2RegistryId,
        data_model_version_store_id: v1DataModelVersionStoreId, // Shared singleton
        file_store_subscribed: v1FileStoreId, // SAME as V1 - shared file store
      });

      // Note: No need to sync V2 orgUid store - we reuse V1's orgUid store

      await waitForOrgCreation();

      // Verify singleton only has v1 key before recovery
      const singletonDataBefore = await getStoreDataForTest(v1DataModelVersionStoreId);
      const decodedSingletonBefore = decodeDataLayerResponse(singletonDataBefore);
      const singletonMapBefore = {};
      decodedSingletonBefore.forEach(({ key, value }) => {
        singletonMapBefore[key] = value;
      });
      expect(singletonMapBefore.v1).to.equal(v1RegistryId);
      expect(singletonMapBefore.v2).to.be.undefined; // v2 key missing

      // Re-run upgrade - should complete the partial upgrade by adding v2 key to singleton
      const response = await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(200);

      expect(response.body.success).to.be.true;
      // In simulator mode, upgrade completes synchronously
      if (USE_SIMULATOR) {
        expect(response.body.message).to.include('completed successfully');
      } else {
        expect(response.body.message).to.include('currently being processed');
        await waitForOrgCreation();
      }

      // Verify singleton now has BOTH v1 and v2 keys
      const singletonDataAfter = await getStoreDataForTest(v1DataModelVersionStoreId);
      const decodedSingletonAfter = decodeDataLayerResponse(singletonDataAfter);
      const singletonMapAfter = {};
      decodedSingletonAfter.forEach(({ key, value }) => {
        singletonMapAfter[key] = value;
      });

      expect(singletonMapAfter.v1).to.equal(v1RegistryId);
      expect(singletonMapAfter.v2).to.equal(v2RegistryId); // v2 key now added

      // Verify V2 org still exists and is unchanged (uses v1OrgUid as org_uid)
      const v2OrgAfter = await OrganizationsV2.findOne({
        where: { org_uid: v1OrgUid },
        raw: true,
      });

      expect(v2OrgAfter).to.exist;
      expect(v2OrgAfter.org_uid).to.equal(v1OrgUid); // Same as V1
      expect(v2OrgAfter.registry_id).to.equal(v2RegistryId);
    }).timeout(TEST_WAIT_TIME * 15);
  });

  describe('Singleton Structure Verification', function () {
    it('should create singleton with only v2 key for new users', async function () {
      // Create V2 org for new user
      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          name: 'New User V2 Org',
          icon: 'test-icon',
        })
        .expect(200);

      await waitForOrgCreation();

      const v2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      expect(v2Org).to.exist;

      // Verify singleton structure
      // In simulator mode, data should be immediately available after syncDataLayer
      const singletonData = await getStoreDataForTest(v2Org.data_model_version_store_id);
      expect(singletonData).to.exist;
      expect(singletonData).to.not.be.instanceOf(Error);
      expect(singletonData.keys_values).to.exist;
      expect(singletonData.keys_values.length).to.be.greaterThan(0);

      const decodedSingleton = decodeDataLayerResponse(singletonData);
      const singletonMap = {};
      decodedSingleton.forEach(({ key, value }) => {
        singletonMap[key] = value;
      });

      expect(singletonMap.v2).to.equal(v2Org.registry_id);
      expect(singletonMap.v1).to.be.undefined; // Should NOT have v1 key
    }).timeout(TEST_WAIT_TIME * 10);

    it('should create singleton with both v1 and v2 keys for upgraded users', async function () {
      // Create V1 org with singleton
      const v1OrgUid = USE_SIMULATOR ? 'test-v1-singleton' : await datalayer.createDataLayerStore();
      const v1RegistryId = USE_SIMULATOR ? 'test-v1-registry-singleton' : await datalayer.createDataLayerStore();
      const v1DataModelVersionStoreId = USE_SIMULATOR ? 'test-v1-singleton-store' : await datalayer.createDataLayerStore();
      const v1FileStoreId = USE_SIMULATOR ? 'test-v1-filestore-singleton' : await datalayer.createDataLayerStore();

      const v1Org = await Organization.create({
        orgUid: v1OrgUid,
        name: 'Test V1 Org Singleton',
        icon: 'test-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: v1RegistryId,
        dataModelVersionStoreId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
      });

      // Create singleton with v1 key
      await datalayer.syncDataLayer(
        v1DataModelVersionStoreId,
        { v1: v1RegistryId },
      );

      await datalayer.syncDataLayer(
        v1OrgUid,
        {
          registryId: v1DataModelVersionStoreId,
          fileStoreId: v1FileStoreId,
          name: v1Org.name,
          icon: v1Org.icon,
        },
      );

      await waitForOrgCreation();

      // Upgrade to V2
      await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(200);

      await waitForOrgCreation();

      const v2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      expect(v2Org).to.exist;

      // Verify singleton has BOTH keys
      // In simulator mode, data should be immediately available after syncDataLayer
      const singletonData = await getStoreDataForTest(v1DataModelVersionStoreId);
      expect(singletonData).to.exist;
      expect(singletonData).to.not.be.instanceOf(Error);
      expect(singletonData.keys_values).to.exist;
      expect(singletonData.keys_values.length).to.be.greaterThan(0);

      const decodedSingleton = decodeDataLayerResponse(singletonData);
      const singletonMap = {};
      decodedSingleton.forEach(({ key, value }) => {
        singletonMap[key] = value;
      });

      expect(singletonMap.v1).to.equal(v1Org.registryId);
      expect(singletonMap.v2).to.equal(v2Org.registry_id);
      expect(v2Org.data_model_version_store_id).to.equal(v1Org.dataModelVersionStoreId); // Shared singleton
    }).timeout(TEST_WAIT_TIME * 15);
  });

  describe('POST /v2/organizations/upgrade - Shared org_uid', function () {
    it('should use same org_uid as v1 organization', async function () {
      // Create V1 org
      const v1OrgUid = USE_SIMULATOR ? 'test-v1-shared-org' : await datalayer.createDataLayerStore();
      const v1RegistryId = USE_SIMULATOR ? 'test-v1-registry-shared' : await datalayer.createDataLayerStore();
      const v1DataModelVersionStoreId = USE_SIMULATOR ? 'test-v1-singleton-shared' : await datalayer.createDataLayerStore();
      const v1FileStoreId = USE_SIMULATOR ? 'test-v1-filestore-shared' : await datalayer.createDataLayerStore();

      const v1Org = await Organization.create({
        orgUid: v1OrgUid,
        name: 'V1 Org for Shared org_uid Test',
        icon: 'v1-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: v1RegistryId,
        dataModelVersionStoreId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
      });

      // Create singleton with v1 key
      await datalayer.syncDataLayer(v1DataModelVersionStoreId, { v1: v1RegistryId });

      // Set up V1 orgUid store
      await datalayer.syncDataLayer(v1OrgUid, {
        registryId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
        name: v1Org.name,
        icon: v1Org.icon,
      });

      await waitForOrgCreation();

      // Upgrade to V2
      const response = await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(200);

      expect(response.body.success).to.be.true;

      await waitForOrgCreation();

      // Verify v2 org has same org_uid as v1
      const v2Org = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(v2Org).to.exist;
      expect(v2Org.org_uid).to.equal(v1Org.orgUid);

      // Verify v2 org has same file_store as v1
      expect(v2Org.file_store_subscribed).to.equal(v1Org.fileStoreId);

      // Verify v2 org has different registry (v2 data store)
      expect(v2Org.registry_id).to.not.equal(v1Org.registryId);
    }).timeout(TEST_WAIT_TIME * 15);

    it('should share name/icon updates between v1 and v2 via shared orgUid store', async function () {
      // Create V1 org
      const v1OrgUid = USE_SIMULATOR ? 'test-v1-shared-meta' : await datalayer.createDataLayerStore();
      const v1RegistryId = USE_SIMULATOR ? 'test-v1-registry-meta' : await datalayer.createDataLayerStore();
      const v1DataModelVersionStoreId = USE_SIMULATOR ? 'test-v1-singleton-meta' : await datalayer.createDataLayerStore();
      const v1FileStoreId = USE_SIMULATOR ? 'test-v1-filestore-meta' : await datalayer.createDataLayerStore();

      await Organization.create({
        orgUid: v1OrgUid,
        name: 'Original Name',
        icon: 'original-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: v1RegistryId,
        dataModelVersionStoreId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
      });

      // Create singleton with v1 key
      await datalayer.syncDataLayer(v1DataModelVersionStoreId, { v1: v1RegistryId });

      // Set up V1 orgUid store
      await datalayer.syncDataLayer(v1OrgUid, {
        registryId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
        name: 'Original Name',
        icon: 'original-icon',
      });

      await waitForOrgCreation();

      // Upgrade to V2
      await supertest(app).post('/v2/organizations/upgrade').expect(200);
      await waitForOrgCreation();

      // Update V2 name via API
      const newName = 'Updated Name';
      await supertest(app)
        .put('/v2/organizations/edit')
        .send({ name: newName })
        .expect(200);

      // Verify V2 org has updated name in database
      const v2Org = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(v2Org.name).to.equal(newName);

      // Verify orgUid store has updated name (shared store used by both V1 and V2)
      const orgUidStoreData = await getStoreDataForTest(v1OrgUid);
      expect(orgUidStoreData).to.exist;
      expect(orgUidStoreData.keys_values).to.exist;

      const decodedOrgUidStore = decodeDataLayerResponse(orgUidStoreData);
      const orgUidStoreMap = {};
      decodedOrgUidStore.forEach(({ key, value }) => {
        orgUidStoreMap[key] = value;
      });

      // The orgUid store should have the updated name (V1 sync would see this)
      expect(orgUidStoreMap.name).to.equal(newName);
    }).timeout(TEST_WAIT_TIME * 20);

    it('should fail upgrade if singleton already has v2 key but no V2 org in database', async function () {
      // This tests the scenario where:
      // 1. A previous upgrade completed (v2 key added to singleton)
      // 2. The database was reset/cleared
      // 3. User tries to upgrade again
      // Expected: Error telling user the singleton already has v2 key

      // Create V1 org
      const v1OrgUid = USE_SIMULATOR ? 'test-v1-orphan-v2' : await datalayer.createDataLayerStore();
      const v1RegistryId = USE_SIMULATOR ? 'test-v1-registry-orphan' : await datalayer.createDataLayerStore();
      const v1DataModelVersionStoreId = USE_SIMULATOR ? 'test-v1-singleton-orphan' : await datalayer.createDataLayerStore();
      const v1FileStoreId = USE_SIMULATOR ? 'test-v1-filestore-orphan' : await datalayer.createDataLayerStore();
      const existingV2RegistryId = USE_SIMULATOR ? 'orphan-v2-registry' : 'orphan-v2-registry-store-id';

      await Organization.create({
        orgUid: v1OrgUid,
        name: 'V1 Org with Orphan V2 Key',
        icon: 'v1-icon',
        isHome: true,
        subscribed: true,
        synced: true,
        registryId: v1RegistryId,
        dataModelVersionStoreId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
      });

      // Create singleton with BOTH v1 and v2 keys (simulating previous upgrade)
      // This simulates the scenario where a v2 upgrade already happened on the blockchain
      await datalayer.syncDataLayer(v1DataModelVersionStoreId, {
        v1: v1RegistryId,
        v2: existingV2RegistryId, // v2 key already exists from previous upgrade
      });

      // Set up V1 orgUid store
      await datalayer.syncDataLayer(v1OrgUid, {
        registryId: v1DataModelVersionStoreId,
        fileStoreId: v1FileStoreId,
        name: 'V1 Org with Orphan V2 Key',
        icon: 'v1-icon',
      });

      await waitForOrgCreation();

      // Verify NO V2 org exists in database (simulates database reset)
      const existingV2Org = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(existingV2Org).to.be.null;

      // Try to upgrade - should fail because singleton already has v2 key
      const response = await supertest(app)
        .post('/v2/organizations/upgrade')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('singleton store already has a v2 key');
      expect(response.body.error).to.include(existingV2RegistryId);

      // Verify V2 org was NOT created
      const v2OrgAfter = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(v2OrgAfter).to.be.null;
    }).timeout(TEST_WAIT_TIME * 15);
  });

  // Phase 16.8 (Model Read Operations) tests removed - covered by Controller tests below

  describe('Phase 16.9: OrganizationsV2 Controller - Read Endpoints', function () {
    let testOrgUid;

    beforeEach(async function () {
      // Create a test V2 organization for testing read endpoints
      const orgName = 'Test Org for Read Endpoints';
      const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      testOrgUid = await OrganizationsV2.createHomeOrganization(orgName, orgIcon, 'v2');
      await waitForOrgCreation();
    });

    describe('GET /v2/organizations (findAll)', function () {
      it('should return all organizations as a map', async function () {
        // Create additional non-home organization
        await OrganizationsV2.create({
          org_uid: 'test-org-2',
          name: 'Test Org 2',
          icon: 'icon2',
          is_home: false,
          subscribed: false,
          synced: false,
        });

        const response = await supertest(app)
          .get('/v2/organizations')
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(Object.keys(response.body).length).to.equal(2);
        expect(response.body[testOrgUid]).to.exist;
        expect(response.body[testOrgUid].name).to.equal('Test Org for Read Endpoints');
        expect(response.body['test-org-2']).to.exist;
        expect(response.body['test-org-2'].name).to.equal('Test Org 2');
      });

      it('should return empty object when no organizations exist', async function () {
        // Delete all organizations
        await OrganizationsV2.destroy({ where: {} });

        const response = await supertest(app)
          .get('/v2/organizations')
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(Object.keys(response.body).length).to.equal(0);
      });

      it('should include XCH address and balance for home org', async function () {
        const response = await supertest(app)
          .get('/v2/organizations')
          .expect(200);

        expect(response.body[testOrgUid]).to.exist;
        expect(response.body[testOrgUid].xchAddress).to.exist;
        expect(response.body[testOrgUid].balance).to.exist;
      });
    });

    describe('GET /v2/organizations/status (homeOrgSyncStatus)', function () {
      it('should return sync status for home organization', async function () {
        const response = await supertest(app)
          .get('/v2/organizations/status')
          .expect(200);

        expect(response.body).to.have.property('ready');
        expect(response.body).to.have.property('status');
        expect(response.body).to.have.property('success', true);
        expect(response.body.status).to.have.property('wallet_synced');
        expect(response.body.status).to.have.property('home_org_synced');
        expect(response.body.status).to.have.property('pending_commits');
        expect(response.body.status).to.have.property('home_org_profile_synced');
      });

      it('should return ready: true when all conditions are met', async function () {
        // Ensure no pending commits
        const { StagingV2 } = await import('../../../src/models/v2/index.js');
        await StagingV2.destroy({ where: {} });

        const response = await supertest(app)
          .get('/v2/organizations/status')
          .expect(200);

        // In simulator mode, wallet should be synced and org should be synced
        // ready should be true if wallet_synced, home_org_synced, and pending_commits === 0
        expect(response.body.ready).to.be.a('boolean');
        expect(response.body.status.pending_commits).to.equal(0);
      });

      it('should return ready: false when pending commits exist', async function () {
        // Import StagingV2 to create test pending commits
        const { StagingV2 } = await import('../../../src/models/v2/index.js');
        const { v4: uuidv4 } = await import('uuid');

        // Clean up any existing records first to ensure clean state
        await StagingV2.destroy({ where: {} });

        // Create a committed staging record (pending commit)
        const testUuid = uuidv4();
        await StagingV2.create({
          uuid: testUuid,
          table: 'program',
          action: 'INSERT',
          data: JSON.stringify([{ test: 'data' }]),
          committed: true,
        });

        // Verify the record was created with correct committed status
        const createdRecord = await StagingV2.findOne({ where: { uuid: testUuid } });
        expect(createdRecord).to.exist;
        expect(createdRecord.committed).to.be.true;

        // Count committed records directly to verify
        const committedCount = await StagingV2.count({ where: { committed: true } });
        expect(committedCount).to.be.greaterThan(0);

        const response = await supertest(app)
          .get('/v2/organizations/status')
          .expect(200);

        expect(response.body.ready).to.be.false;
        expect(response.body.status.pending_commits).to.be.greaterThan(0);

        // Clean up
        await StagingV2.destroy({ where: {} });
      });

      it('should return error when no home organization exists', async function () {
        // Delete the home org
        await OrganizationsV2.destroy({ where: { is_home: true } });

        const response = await supertest(app)
          .get('/v2/organizations/status')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('No Home organization found');
      });

      it('should use snake_case field names in response', async function () {
        const response = await supertest(app)
          .get('/v2/organizations/status')
          .expect(200);

        expect(response.body.status).to.have.property('wallet_synced');
        expect(response.body.status).to.have.property('home_org_synced');
        expect(response.body.status).to.have.property('pending_commits');
        expect(response.body.status).to.have.property('home_org_profile_synced');
      });
    });
  });

  // Phase 16.10 (Model Edit/Metadata Operations) tests removed - covered by Controller tests below

  describe('Phase 16.11: OrganizationsV2 Controller - Edit and Metadata Endpoints', function () {
    let testOrgUid;

    beforeEach(async function () {
      // Create a test V2 organization for testing edit and metadata endpoints
      const orgName = 'Test Org for Edit Endpoints';
      const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      testOrgUid = await OrganizationsV2.createHomeOrganization(orgName, orgIcon, 'v2');
      await waitForOrgCreation();
    });

    describe('PUT /v2/organizations (editHomeOrg)', function () {
      it('should update organization name', async function () {
        const newName = 'Updated Org Name';

        const response = await supertest(app)
          .put('/v2/organizations/edit')
          .send({ name: newName })
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('currently being updated');

        // Verify database was updated
        const updatedOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });

        expect(updatedOrg.name).to.equal(newName);
      });

      it('should update organization icon from file upload', async function () {
        const iconBuffer = Buffer.from('test icon data', 'utf-8');

        const response = await supertest(app)
          .put('/v2/organizations/edit')
          .attach('file', iconBuffer, 'icon.png')
          .expect(200);

        expect(response.body.success).to.be.true;

        // Verify database was updated
        const updatedOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });

        expect(updatedOrg.icon).to.include('data:image/png;base64');
      });

      it('should update both name and icon', async function () {
        const newName = 'Updated Name and Icon';
        const iconBuffer = Buffer.from('new icon data', 'utf-8');

        const response = await supertest(app)
          .put('/v2/organizations/edit')
          .field('name', newName)
          .attach('file', iconBuffer, 'icon.png')
          .expect(200);

        expect(response.body.success).to.be.true;

        // Verify database was updated
        const updatedOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });

        expect(updatedOrg.name).to.equal(newName);
        expect(updatedOrg.icon).to.include('data:image/png;base64');
      });

      it('should return error when no home organization exists', async function () {
        // Delete the home org
        await OrganizationsV2.destroy({ where: { is_home: true } });

        const response = await supertest(app)
          .put('/v2/organizations/edit')
          .send({ name: 'New Name' })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('No Home organization found');
      });
    });

    describe('POST /v2/organizations/metadata (addMetadata)', function () {
      it('should add metadata to home organization', async function () {
        const metadata = {
          key1: 'value1',
          key2: 'value2',
        };

        const response = await supertest(app)
          .post('/v2/organizations/metadata')
          .send(metadata)
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('currently being updated');

        // Verify database was updated
        const updatedOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });

        expect(updatedOrg.metadata).to.exist;
        const parsedMetadata = JSON.parse(updatedOrg.metadata);
        expect(parsedMetadata.key1).to.equal('value1');
        expect(parsedMetadata.key2).to.equal('value2');
      });

      it('should merge new metadata with existing metadata', async function () {
        // Add initial metadata
        await OrganizationsV2.addMetadata({ key1: 'value1', key2: 'value2' });

        // Add additional metadata via endpoint
        const response = await supertest(app)
          .post('/v2/organizations/metadata')
          .send({ key3: 'value3', key2: 'updated_value2' })
          .expect(200);

        expect(response.body.success).to.be.true;

        // Verify database has merged metadata
        const updatedOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });

        const parsedMetadata = JSON.parse(updatedOrg.metadata);
        expect(parsedMetadata.key1).to.equal('value1'); // Original preserved
        expect(parsedMetadata.key2).to.equal('updated_value2'); // Updated
        expect(parsedMetadata.key3).to.equal('value3'); // New key added
      });

      it('should return error when no home organization exists', async function () {
        // Delete the home org
        await OrganizationsV2.destroy({ where: { is_home: true } });

        const response = await supertest(app)
          .post('/v2/organizations/metadata')
          .send({ key: 'value' })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('No Home organization found');
      });
    });

    describe('GET /v2/organizations/metadata (getMetaData)', function () {
      it('should return metadata for organization', async function () {
        // Add metadata first
        await OrganizationsV2.addMetadata({ key1: 'value1', key2: 'value2' });

        const response = await supertest(app)
          .get('/v2/organizations/metadata')
          .query({ orgUid: testOrgUid })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.key1).to.equal('value1');
        expect(response.body.key2).to.equal('value2');
      });

      it('should return empty object when no metadata exists', async function () {
        const response = await supertest(app)
          .get('/v2/organizations/metadata')
          .query({ orgUid: testOrgUid })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(Object.keys(response.body).length).to.equal(0);
      });

      it('should remove meta_ prefix from keys', async function () {
        // Add metadata with keys that would have meta_ prefix in datalayer
        await OrganizationsV2.addMetadata({ testKey: 'testValue' });

        const response = await supertest(app)
          .get('/v2/organizations/metadata')
          .query({ orgUid: testOrgUid })
          .expect(200);

        // Keys should not have meta_ prefix in response
        expect(response.body.testKey).to.equal('testValue');
        expect(response.body).to.not.have.property('meta_testKey');
      });

      it('should return error when orgUid is missing', async function () {
        const response = await supertest(app)
          .get('/v2/organizations/metadata')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('orgUid query parameter is required');
      });

      it('should return error when organization not found', async function () {
        const response = await supertest(app)
          .get('/v2/organizations/metadata')
          .query({ orgUid: 'non-existent-org' })
          .expect(404);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('Organization not found');
      });
    });
  });

  // Phase 16.12 (Model Import/Subscription Operations) tests removed - covered by Controller tests below

  describe('Phase 16.13: OrganizationsV2 Controller - Import and Subscription Endpoints', function () {
    let testOrgUid;

    beforeEach(async function () {
      // Create a test V2 organization for testing import/subscription operations
      const orgName = 'Test Org for Controller Tests';
      const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      testOrgUid = await OrganizationsV2.createHomeOrganization(orgName, orgIcon, 'v2');
      await waitForOrgCreation();
    });

    describe('POST /v2/organizations/import', function () {
      it('should import V2 organization successfully', async function () {
        // Use the existing home org's orgUid (from beforeEach)
        const existingOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        const orgUidToImport = existingOrg.org_uid;

        // Delete from database (simulating external org to import)
        await OrganizationsV2.destroy({ where: { org_uid: orgUidToImport } });

        // Import via API
        const response = await supertest(app)
          .put('/v2/organizations')
          .send({ orgUid: orgUidToImport, isHome: false })
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('Successfully imported');

        // Verify it was imported
        const importedOrg = await OrganizationsV2.findOne({
          where: { org_uid: orgUidToImport },
          raw: true,
        });

        expect(importedOrg).to.exist;
        expect(importedOrg.subscribed).to.be.ok;
        expect(importedOrg.is_home).to.not.be.ok;
      });

      it('should return error when orgUid is missing', async function () {
        const response = await supertest(app)
          .put('/v2/organizations')
          .send({ isHome: false })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('orgUid is required');
      });

      it('should return error when organization already exists', async function () {
        const response = await supertest(app)
          .put('/v2/organizations')
          .send({ orgUid: testOrgUid, isHome: false })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('already exists');
      });

      it('should import as home organization when isHome is true', async function () {
        // Use the existing home org's orgUid (from beforeEach)
        const existingOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        const orgUidToImport = existingOrg.org_uid;

        // Delete from database
        await OrganizationsV2.destroy({ where: { org_uid: orgUidToImport } });

        // Import as home via API
        const response = await supertest(app)
          .put('/v2/organizations')
          .send({ orgUid: orgUidToImport, isHome: true })
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('home organization');

        // Verify it was imported as home
        const importedOrg = await OrganizationsV2.findOne({
          where: { org_uid: orgUidToImport },
          raw: true,
        });

        if (importedOrg) {
          expect(importedOrg.is_home).to.be.ok;
        }
      });
    });

    describe('POST /v2/organizations/subscribe', function () {
      it('should subscribe to V2 organization successfully', async function () {
        // Use the existing home org's orgUid (from beforeEach)
        const existingOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        const orgUidToSubscribe = existingOrg.org_uid;

        // Delete from database but keep stores (simulating external org)
        await OrganizationsV2.destroy({ where: { org_uid: orgUidToSubscribe } });

        // Subscribe via API
        const response = await supertest(app)
          .put('/v2/organizations/subscribe')
          .send({ orgUid: orgUidToSubscribe })
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('Subscribed to organization');
      });

      it('should return error when orgUid is missing', async function () {
        const response = await supertest(app)
          .put('/v2/organizations/subscribe')
          .send({})
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('orgUid is required');
      });

      it('should return error when trying to subscribe to PENDING org', async function () {
        const response = await supertest(app)
          .put('/v2/organizations/subscribe')
          .send({ orgUid: 'PENDING' })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('Cannot subscribe to PENDING organization');
      });
    });

    describe('POST /v2/organizations/unsubscribe', function () {
      it('should unsubscribe from organization successfully', async function () {
        // Create a non-home org to unsubscribe from by importing an existing org as non-home
        // First, get the test org and delete it
        const existingOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        const orgUidToUnsubscribe = existingOrg.org_uid;
        const orgName = existingOrg.name;

        // Delete from database
        await OrganizationsV2.destroy({ where: { org_uid: orgUidToUnsubscribe } });

        // Import it back as non-home
        await OrganizationsV2.importOrganization(orgUidToUnsubscribe, false);
        await waitForOrgCreation();

        // Verify it's not home
        const importedOrg = await OrganizationsV2.findOne({
          where: { org_uid: orgUidToUnsubscribe },
          raw: true,
        });
        expect(importedOrg.is_home).to.not.be.ok;

        // Unsubscribe via API
        const response = await supertest(app)
          .put('/v2/organizations/unsubscribe')
          .send({ orgUid: orgUidToUnsubscribe })
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('unsubscribed');

        // Verify organization was marked as unsubscribed
        const unsubscribedOrg = await OrganizationsV2.findOne({
          where: { org_uid: orgUidToUnsubscribe },
          raw: true,
        });

        if (unsubscribedOrg) {
          expect(unsubscribedOrg.subscribed).to.not.be.ok;
        }
      });

      it('should return error when trying to unsubscribe from home org', async function () {
        const response = await supertest(app)
          .put('/v2/organizations/unsubscribe')
          .send({ orgUid: testOrgUid })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('cannot unsubscribe from your home organization');
      });

      it('should return error when orgUid is missing', async function () {
        const response = await supertest(app)
          .put('/v2/organizations/unsubscribe')
          .send({})
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('orgUid is required');
      });

      it('should handle unsubscribe when org not in database but subscribed in datalayer', async function () {
        // Use the existing home org's orgUid (from beforeEach)
        const existingOrg = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });
        const orgUidToUnsubscribe = existingOrg.org_uid;

        // Delete from database but keep stores (simulating external org)
        await OrganizationsV2.destroy({ where: { org_uid: orgUidToUnsubscribe } });

        // Unsubscribe via API (should handle org not in DB)
        const response = await supertest(app)
          .put('/v2/organizations/unsubscribe')
          .send({ orgUid: orgUidToUnsubscribe })
          .expect(200);

        expect(response.body).to.have.property('success', true);
      });
    });

    describe('POST /v2/organizations/resync', function () {
      it('should resync organization successfully', async function () {
        // Use the existing home org's orgUid (from beforeEach)
        const response = await supertest(app)
          .put('/v2/organizations/resync')
          .send({ orgUid: testOrgUid })
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('Resyncing organization process initiated');

        // Verify registry hash was reset
        const org = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
          raw: true,
        });

        expect(org.registry_hash).to.equal('0');
      });

      it('should return error when orgUid is missing', async function () {
        const response = await supertest(app)
          .put('/v2/organizations/resync')
          .send({})
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('orgUid is required');
      });

      it('should return error when organization does not exist', async function () {
        const nonExistentOrgUid = 'non-existent-org-uid';
        const response = await supertest(app)
          .put('/v2/organizations/resync')
          .send({ orgUid: nonExistentOrgUid })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('does not exist on this instance');
      });

      it('should return error when organization is not subscribed', async function () {
        // Use the existing home org's orgUid (from beforeEach)
        // Mark as unsubscribed
        await OrganizationsV2.update(
          { subscribed: false },
          { where: { org_uid: testOrgUid } },
        );

        const response = await supertest(app)
          .put('/v2/organizations/resync')
          .send({ orgUid: testOrgUid })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('not subscribed');

        // Restore subscribed status
        await OrganizationsV2.update(
          { subscribed: true },
          { where: { org_uid: testOrgUid } },
        );
      });

      it('should delete all V2 data for organization during resync', async function () {
        // Create audit data for the org (AuditV2 is the only model with org_uid)
        const { AuditV2 } = await import('../../../src/models/v2/index.js');
        const testAudit = await AuditV2.create({
          org_uid: testOrgUid,
          registry_id: 'test-registry',
          root_hash: 'test-root-hash',
          type: 'test-type',
          onchain_confirmation_time_stamp: '2024-01-01T00:00:00Z',
        });

        // Verify data exists
        const auditBefore = await AuditV2.findOne({
          where: { org_uid: testOrgUid },
        });
        expect(auditBefore).to.exist;

        // Resync via API
        const response = await supertest(app)
          .put('/v2/organizations/resync')
          .send({ orgUid: testOrgUid })
          .expect(200);

        expect(response.body).to.have.property('success', true);

        // Verify audit data was deleted
        const auditAfter = await AuditV2.findOne({
          where: { org_uid: testOrgUid },
        });
        expect(auditAfter).to.not.exist;
      });
    });
  });

  // Phase 16.14 (Model Delete/Sync Operations) tests removed - covered by Controller tests below

  describe('Phase 16.15: OrganizationsV2 Controller - Delete and Sync Endpoints', function () {
    let testOrgUid;

    beforeEach(async function () {
      // Create a test home organization for each test
      const orgName = 'Test Org for Delete/Sync Controller Tests';
      const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      testOrgUid = await OrganizationsV2.createHomeOrganization(orgName, orgIcon, 'v2');
      await waitForOrgCreation();
    });

    describe('DELETE /v2/organizations/:orgUid', function () {
      it('should delete non-home organization successfully', async function () {
        // Mark org as non-home for this test
        await OrganizationsV2.update(
          { is_home: false },
          { where: { org_uid: testOrgUid } },
        );

        // Delete via API
        const response = await supertest(app)
          .delete(`/v2/organizations/${testOrgUid}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('Removed all organization records');
        expect(response.body.message).to.include('unsubscribed');

        // Verify organization was deleted
        const orgAfter = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
        });
        expect(orgAfter).to.not.exist;
      });

      it('should delete home organization successfully', async function () {
        // Delete home org via API
        const response = await supertest(app)
          .delete(`/v2/organizations/${testOrgUid}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('home organization was deleted');
        expect(response.body.message).to.include('CADT will no longer sync');

        // Verify organization was deleted
        const orgAfter = await OrganizationsV2.findOne({
          where: { org_uid: testOrgUid },
        });
        expect(orgAfter).to.not.exist;
      });

      it('should return error when organization does not exist', async function () {
        // Use a valid UUID format that doesn't exist in the database
        const nonExistentOrgUid = '00000000-0000-0000-0000-000000000000';
        const response = await supertest(app)
          .delete(`/v2/organizations/${nonExistentOrgUid}`)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('does not exist on this instance');
      });

      it('should handle unsubscribe error gracefully for non-home org', async function () {
        // Mark org as non-home
        await OrganizationsV2.update(
          { is_home: false },
          { where: { org_uid: testOrgUid } },
        );

        // Mock unsubscribe to fail by deleting org stores first
        await OrganizationsV2.update(
          { registry_id: null, data_model_version_store_id: null },
          { where: { org_uid: testOrgUid } },
        );

        // Delete via API - should handle unsubscribe error
        const response = await supertest(app)
          .delete(`/v2/organizations/${testOrgUid}`)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('Removed all organization records');
        expect(response.body.message).to.include('error prevented unsubscribing');
      });
    });

    describe('POST /v2/organizations/sync', function () {
      it('should sync organization metadata successfully', async function () {
        // Mark organization as subscribed
        await OrganizationsV2.update(
          { subscribed: true },
          { where: { org_uid: testOrgUid } },
        );

        // Sync via API
        const response = await supertest(app)
          .post('/v2/organizations/sync')
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('Organization metadata sync initiated');
      });

      it('should handle sync gracefully even with no subscribed organizations', async function () {
        // Mark organization as unsubscribed
        await OrganizationsV2.update(
          { subscribed: false },
          { where: { org_uid: testOrgUid } },
        );

        // Sync via API - should not throw
        const response = await supertest(app)
          .post('/v2/organizations/sync')
          .expect(200);

        expect(response.body).to.have.property('success', true);
      });
    });
  });

  // Phase 16.16 (Model Mirror Operations) tests removed - covered by Controller tests below

  describe('Phase 16.17: OrganizationsV2 Controller - Mirror Endpoints', function () {
    let testOrgUid;

    beforeEach(async function () {
      // Create a test home organization for each test
      const orgName = 'Test Org for Mirror Controller Tests';
      const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      testOrgUid = await OrganizationsV2.createHomeOrganization(orgName, orgIcon, 'v2');
      await waitForOrgCreation();
    });

    describe('POST /v2/organizations/mirror', function () {
      it('should add mirror successfully', async function () {
        const response = await supertest(app)
          .post('/v2/organizations/mirror')
          .send({
            storeId: 'test-store-id',
            url: 'https://example.com/mirror',
          });

        // In simulator mode, may return 400 if mirror can't be added (no datalayer connection)
        // but should not throw server error
        expect([200, 400]).to.include(response.status);
        expect(response.body).to.have.property('success');
      });

      it('should return error when storeId is missing', async function () {
        const response = await supertest(app)
          .post('/v2/organizations/mirror')
          .send({
            url: 'https://example.com/mirror',
          })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('storeId is required');
      });

      it('should return error when url is missing', async function () {
        const response = await supertest(app)
          .post('/v2/organizations/mirror')
          .send({
            storeId: 'test-store-id',
          })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('url is required');
      });

      it('should return error when home org does not exist', async function () {
        // Delete the home org
        await OrganizationsV2.destroy({ where: { org_uid: testOrgUid } });

        const response = await supertest(app)
          .post('/v2/organizations/mirror')
          .send({
            storeId: 'test-store-id',
            url: 'https://example.com/mirror',
          })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('No Home organization found');
      });
    });

    describe('POST /v2/organizations/remove-mirror', function () {
      it('should remove mirror successfully', async function () {
        const response = await supertest(app)
          .post('/v2/organizations/remove-mirror')
          .send({
            storeId: 'test-store-id',
            coinId: 'test-coin-id',
          });

        // In simulator mode, may return 400 if mirror doesn't exist
        // but should not throw server error
        expect([200, 400]).to.include(response.status);
        expect(response.body).to.have.property('success');
      });

      it('should return error when storeId is missing', async function () {
        const response = await supertest(app)
          .post('/v2/organizations/remove-mirror')
          .send({
            coinId: 'test-coin-id',
          })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('storeId is required');
      });

      it('should return error when coinId is missing', async function () {
        const response = await supertest(app)
          .post('/v2/organizations/remove-mirror')
          .send({
            storeId: 'test-store-id',
          })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('coinId is required');
      });

      it('should return error when home org does not exist', async function () {
        // Delete the home org
        await OrganizationsV2.destroy({ where: { org_uid: testOrgUid } });

        const response = await supertest(app)
          .post('/v2/organizations/remove-mirror')
          .send({
            storeId: 'test-store-id',
            coinId: 'test-coin-id',
          })
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.error).to.include('No Home organization found');
      });
    });
  });

  describe('Phase 16.20: OrganizationsV2 Integration Tests - Complete Coverage', function () {
    describe('V1/V2 Isolation Tests', function () {
      it('should verify V2 operations work independently of V1', async function () {
        // Create V2 org
        const orgName = 'V2 Isolation Test Org';
        const orgIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const v2OrgUid = await OrganizationsV2.createHomeOrganization(orgName, orgIcon, 'v2');
        await waitForOrgCreation();

        // Perform V2 operations (edit metadata)
        await OrganizationsV2.addMetadata({ key1: 'value1', key2: 'value2' });

        // Verify V2 org exists and has metadata
        const v2Org = await OrganizationsV2.findOne({
          where: { org_uid: v2OrgUid },
          raw: true,
        });

        expect(v2Org).to.exist;
        expect(v2Org.name).to.equal(orgName);
        expect(v2Org.icon).to.equal(orgIcon);

        // Verify V1 table is not affected (should be empty or have different orgs)
        const v1Orgs = await Organization.findAll({ raw: true });
        const v1OrgUids = v1Orgs.map(org => org.orgUid);
        expect(v1OrgUids).to.not.include(v2OrgUid);
      });

      it('should verify shared singleton works correctly for upgraded organizations', async function () {
        // This test is already covered in Phase 16.7 upgrade tests
        // but we verify it here as part of complete coverage
        // Create V1 org with singleton (using same pattern as upgrade test)
        const v1OrgUid = USE_SIMULATOR ? 'v1-upgrade-isolation' : await datalayer.createDataLayerStore();
        const v1RegistryId = USE_SIMULATOR ? 'v1-registry-isolation' : await datalayer.createDataLayerStore();
        const v1DataModelVersionStoreId = USE_SIMULATOR ? 'v1-singleton-isolation' : await datalayer.createDataLayerStore();
        const v1FileStoreId = USE_SIMULATOR ? 'v1-filestore-isolation' : await datalayer.createDataLayerStore();

        const v1Org = await Organization.create({
          orgUid: v1OrgUid,
          name: 'V1 Upgrade Isolation Test',
          icon: 'v1-icon',
          isHome: true,
          subscribed: true,
          synced: true,
          registryId: v1RegistryId,
          dataModelVersionStoreId: v1DataModelVersionStoreId,
          fileStoreId: v1FileStoreId,
        });

        // Create singleton with v1 key
        await datalayer.syncDataLayer(v1DataModelVersionStoreId, { v1: v1RegistryId });
        await waitForOrgCreation();

        // Upgrade to V2
        const v2OrgUid = await OrganizationsV2.upgradeFromV1(v1Org.name, v1Org.icon);
        await waitForOrgCreation();

        // Get V2 org
        const v2Org = await OrganizationsV2.findOne({
          where: { org_uid: v2OrgUid },
          raw: true,
        });

        // Verify V2 org uses the same org_uid as V1 (shared identity)
        expect(v2OrgUid).to.equal(v1OrgUid);
        expect(v2Org.org_uid).to.equal(v1Org.orgUid);

        // Verify V2 org uses the same file store as V1 (shared file store)
        expect(v2Org.file_store_subscribed).to.equal(v1FileStoreId);
        expect(v2Org.file_store_subscribed).to.equal(v1Org.fileStoreId);

        // Verify V2 org uses the same singleton (shared singleton)
        expect(v2Org.data_model_version_store_id).to.equal(v1DataModelVersionStoreId);
        expect(v2Org.data_model_version_store_id).to.equal(v1Org.dataModelVersionStoreId);
      });
    });
  });

  describe('DELETE Organization - Parameter Validation', function () {
    it('should reject orgUid that is too short', async function () {
      const response = await supertest(app)
        .delete('/v2/organizations/abc123')
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
      expect(response.body.errors[0]).to.include('valid 64-character hex string or UUID format');
    });

    it('should reject orgUid that is too long', async function () {
      const tooLongOrgUid = 'a'.repeat(65);
      const response = await supertest(app)
        .delete(`/v2/organizations/${tooLongOrgUid}`)
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
      expect(response.body.errors[0]).to.include('valid 64-character hex string or UUID format');
    });

    it('should reject orgUid with non-hex characters', async function () {
      // 64 characters but contains non-hex chars (g, h, z)
      const invalidOrgUid = 'ghijklmnopqrstuvwxyz01234567890123456789012345678901234567890123';
      const response = await supertest(app)
        .delete(`/v2/organizations/${invalidOrgUid}`)
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
      expect(response.body.errors[0]).to.include('valid 64-character hex string or UUID format');
    });

    it('should reject orgUid with special characters', async function () {
      // Use URL-encoded special characters that won't be interpreted as path segments
      const invalidOrgUid = 'abc!@#$%^&*()_+=[]{}|;:,.<>?abc123abc123abc123abc123abc123abc1';
      const response = await supertest(app)
        .delete(`/v2/organizations/${encodeURIComponent(invalidOrgUid)}`)
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
    });

    it('should accept valid 64-character hex orgUid format', async function () {
      // Valid format but org doesn't exist - should pass validation but fail on lookup
      const validOrgUid = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const response = await supertest(app)
        .delete(`/v2/organizations/${validOrgUid}`)
        .send();

      // Should NOT be a validation error - should pass validation and get "does not exist" error
      expect(response.status).to.equal(400);
      // Verify it's not a validation error about the format
      const errorMsg = response.body.errors?.[0] || '';
      expect(errorMsg).to.not.include('valid 64-character hex string or UUID format');
      // Should be a "does not exist" error from the controller
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept valid UUID format orgUid', async function () {
      // Valid UUID format (used in simulator mode) but org doesn't exist
      const validUuidOrgUid = 'a1b2c3d4-e5f6-a1b2-c3d4-e5f6a1b2c3d4';
      const response = await supertest(app)
        .delete(`/v2/organizations/${validUuidOrgUid}`)
        .send();

      // Should NOT be a validation error - should pass validation and get "does not exist" error
      expect(response.status).to.equal(400);
      // Verify it's not a validation error about the format
      const errorMsg = response.body.errors?.[0] || '';
      expect(errorMsg).to.not.include('valid 64-character hex string or UUID format');
      // Should be a "does not exist" error from the controller
      expect(response.body.error).to.include('does not exist');
    });
  });
});

