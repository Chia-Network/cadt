import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db, sequelizeV2 } from '../../../src/database/v2/index.js';
import { OrganizationsV2, MetaV2 } from '../../../src/models/v2/index.js';
import { Organization, Meta } from '../../../src/models/index.js';
import { getConfig } from '../../../src/utils/config-loader.js';
import {
  ORG_CREATION_STATES,
  ORG_CREATION_CONFIG,
  createInitialState,
  saveCreationState,
  loadCreationState,
  clearCreationState,
  getStatusSummary,
  markStoreCreated,
  markStoreConfirmed,
  markStoreDataWritten,
  STORE_TYPES,
} from '../../../src/utils/organization-creation-state.js';

const { USE_SIMULATOR } = getConfig().APP;

/**
 * Tests for parallel organization creation and creation status endpoint
 *
 * These tests verify:
 * 1. The creation status endpoint works correctly
 * 2. State management utilities work correctly
 * 3. Organization creation status is properly tracked
 */
describe('Organization Creation Status Tests', function () {
  this.timeout(60000); // 1 minute timeout for tests

  before(async function () {
    console.log('Setting up test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up all organizations and state before each test
    await OrganizationsV2.destroy({ where: {} });
    await Organization.destroy({ where: {} });
    await clearCreationState(MetaV2, 'v2');
    await clearCreationState(Meta, 'v1');
  });

  describe('State Management Utilities', function () {
    it('should create initial state correctly', function () {
      const state = createInitialState('Test Org', 'test-icon', 'v2', 'v2');

      expect(state.state).to.equal(ORG_CREATION_STATES.INITIALIZING);
      expect(state.name).to.equal('Test Org');
      expect(state.icon).to.equal('test-icon');
      expect(state.dataVersion).to.equal('v2');
      expect(state.apiVersion).to.equal('v2');
      expect(state.retryCount).to.equal(0);
      expect(state.stores).to.exist;
      expect(state.stores.orgUid.id).to.be.null;
      expect(state.stores.registry.id).to.be.null;
      expect(state.startedAt).to.exist;
    });

    it('should mark store as created', function () {
      let state = createInitialState('Test Org', '', 'v2', 'v2');
      state = markStoreCreated(state, STORE_TYPES.ORG_UID, 'test-store-id');

      expect(state.stores.orgUid.id).to.equal('test-store-id');
      expect(state.stores.orgUid.confirmed).to.be.false;
    });

    it('should mark store as confirmed', function () {
      let state = createInitialState('Test Org', '', 'v2', 'v2');
      state = markStoreCreated(state, STORE_TYPES.ORG_UID, 'test-store-id');
      state = markStoreConfirmed(state, STORE_TYPES.ORG_UID);

      expect(state.stores.orgUid.id).to.equal('test-store-id');
      expect(state.stores.orgUid.confirmed).to.be.true;
    });

    it('should mark store data as written', function () {
      let state = createInitialState('Test Org', '', 'v2', 'v2');
      state = markStoreCreated(state, STORE_TYPES.ORG_UID, 'test-store-id');
      state = markStoreConfirmed(state, STORE_TYPES.ORG_UID);
      state = markStoreDataWritten(state, STORE_TYPES.ORG_UID);

      expect(state.stores.orgUid.dataWritten).to.be.true;
    });

    it('should generate correct status summary', function () {
      let state = createInitialState('Test Org', '', 'v2', 'v2');

      // Test INITIALIZING state
      let summary = getStatusSummary(state);
      expect(summary.inProgress).to.be.true;
      expect(summary.state).to.equal(ORG_CREATION_STATES.INITIALIZING);
      expect(summary.progress).to.equal(0);

      // Test null state
      summary = getStatusSummary(null);
      expect(summary.inProgress).to.be.false;
      expect(summary.state).to.be.null;
    });

    it('should save and load state correctly for V2', async function () {
      const state = createInitialState('Test Org', 'icon', 'v2', 'v2');
      await saveCreationState(state, MetaV2);

      const loaded = await loadCreationState(MetaV2, 'v2');
      expect(loaded).to.exist;
      expect(loaded.name).to.equal('Test Org');
      expect(loaded.icon).to.equal('icon');
      expect(loaded.state).to.equal(ORG_CREATION_STATES.INITIALIZING);
    });

    it('should clear state correctly for V2', async function () {
      const state = createInitialState('Test Org', '', 'v2', 'v2');
      await saveCreationState(state, MetaV2);

      await clearCreationState(MetaV2, 'v2');

      const loaded = await loadCreationState(MetaV2, 'v2');
      expect(loaded).to.be.null;
    });

    it('should save and load state correctly for V1', async function () {
      const state = createInitialState('Test Org', 'icon', 'v1', 'v1');
      await saveCreationState(state, Meta);

      const loaded = await loadCreationState(Meta, 'v1');
      expect(loaded).to.exist;
      expect(loaded.name).to.equal('Test Org');
      expect(loaded.apiVersion).to.equal('v1');
    });
  });

  describe('V2 Creation Status API Endpoint', function () {
    it('should return no creation in progress when no state exists', async function () {
      const response = await supertest(app)
        .get('/v2/organizations/creation-status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.inProgress).to.be.false;
      expect(response.body.state).to.be.null;
      expect(response.body.message).to.include('No organization creation in progress');
    });

    it('should return correct status when creation is in progress', async function () {
      // Create a state that simulates in-progress creation
      let state = createInitialState('Test Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      state = markStoreCreated(state, STORE_TYPES.ORG_UID, 'test-store-id');
      state = markStoreConfirmed(state, STORE_TYPES.ORG_UID);
      await saveCreationState(state, MetaV2);

      const response = await supertest(app)
        .get('/v2/organizations/creation-status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.inProgress).to.be.true;
      expect(response.body.state).to.equal(ORG_CREATION_STATES.STORES_CREATING);
      expect(response.body.stores).to.exist;
      expect(response.body.stores.orgUid.id).to.equal('test-store-id');
      expect(response.body.stores.orgUid.confirmed).to.be.true;
    });

    it('should return correct status when creation is complete', async function () {
      let state = createInitialState('Test Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.COMPLETE;
      await saveCreationState(state, MetaV2);

      const response = await supertest(app)
        .get('/v2/organizations/creation-status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.inProgress).to.be.false;
      expect(response.body.state).to.equal(ORG_CREATION_STATES.COMPLETE);
      expect(response.body.progress).to.equal(100);
    });

    it('should return correct status when creation has failed', async function () {
      let state = createInitialState('Test Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.FAILED;
      state.error = 'Test error message';
      await saveCreationState(state, MetaV2);

      const response = await supertest(app)
        .get('/v2/organizations/creation-status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.inProgress).to.be.false;
      expect(response.body.state).to.equal(ORG_CREATION_STATES.FAILED);
      expect(response.body.error).to.equal('Test error message');
    });
  });

  describe('V1 Creation Status API Endpoint', function () {
    it('should return no creation in progress when no state exists', async function () {
      const response = await supertest(app)
        .get('/v1/organizations/creation-status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.inProgress).to.be.false;
      expect(response.body.state).to.be.null;
    });

    it('should return correct status when creation is in progress', async function () {
      // Create a state that simulates in-progress creation
      let state = createInitialState('Test Org', '', 'v1', 'v1');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(state, Meta);

      const response = await supertest(app)
        .get('/v1/organizations/creation-status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.inProgress).to.be.true;
      expect(response.body.state).to.equal(ORG_CREATION_STATES.STORES_CREATING);
    });
  });

  describe('V2 Organization Creation with Status Tracking', function () {
    it('should create organization and track status in simulator mode', async function () {
      if (!USE_SIMULATOR) {
        this.skip();
      }

      // Check no org exists
      const orgBefore = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(orgBefore).to.be.null;

      // Create organization
      const response = await supertest(app)
        .post('/v2/organizations')
        .send({
          name: 'Test Organization',
          icon: '',
        })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.orgUid).to.exist;

      // In simulator mode, creation is synchronous, so state should be cleared
      // Wait a moment for async cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify org was created
      const org = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(org).to.exist;
      expect(org.name).to.equal('Test Organization');
      // SQLite stores booleans as integers (0/1), so check for truthy value
      expect(Boolean(org.subscribed)).to.be.true;

      // Verify state was cleared after successful creation
      const statusResponse = await supertest(app)
        .get('/v2/organizations/creation-status')
        .expect(200);

      expect(statusResponse.body.inProgress).to.be.false;
    });
  });

  describe('V1 Organization Creation with Status Tracking', function () {
    it('should create organization and track status in simulator mode', async function () {
      if (!USE_SIMULATOR) {
        this.skip();
      }

      // Check no org exists
      const orgBefore = await Organization.findOne({ where: { isHome: true }, raw: true });
      expect(orgBefore).to.be.null;

      // Create organization
      const response = await supertest(app)
        .post('/v1/organizations')
        .send({
          name: 'Test V1 Organization',
          icon: '',
        })
        .expect(200);

      expect(response.body.success).to.be.true;
      // V1 creation is now async - it returns immediately without orgId
      // The orgId will be available after creation completes
      expect(response.body.message).to.include('currently being created');

      // Wait for org creation to complete (poll for org to exist)
      let org = null;
      for (let attempt = 1; attempt <= 20; attempt++) {
        org = await Organization.findOne({ where: { isHome: true }, raw: true });
        if (org) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verify org was created
      expect(org).to.exist;
      expect(org.name).to.equal('Test V1 Organization');
      // orgUid is fixed in simulator mode for V1
      expect(org.orgUid).to.equal('f1c54511-865e-4611-976c-7c3c1f704662');
      // But other store IDs should be random UUIDs (not fixed)
      expect(org.registryId).to.exist;
      expect(org.dataModelVersionStoreId).to.exist;
      expect(org.fileStoreId).to.exist;

      // Verify state was cleared after successful creation
      const statusResponse = await supertest(app)
        .get('/v1/organizations/creation-status')
        .expect(200);

      expect(statusResponse.body.inProgress).to.be.false;
    });
  });

  describe('Progress Calculation', function () {
    it('should calculate progress correctly at each stage', function () {
      // INITIALIZING = 0%
      let state = createInitialState('Test', '', 'v2', 'v2');
      let summary = getStatusSummary(state);
      expect(summary.progress).to.equal(0);

      // STORES_CREATING with 2/4 confirmed = ~25%
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      state = markStoreCreated(state, STORE_TYPES.ORG_UID, 'id1');
      state = markStoreCreated(state, STORE_TYPES.REGISTRY, 'id2');
      state = markStoreConfirmed(state, STORE_TYPES.ORG_UID);
      state = markStoreConfirmed(state, STORE_TYPES.REGISTRY);
      summary = getStatusSummary(state);
      expect(summary.progress).to.equal(25); // 2/4 * 50 = 25

      // STORES_CONFIRMED = 50%
      state.state = ORG_CREATION_STATES.STORES_CONFIRMED;
      summary = getStatusSummary(state);
      expect(summary.progress).to.equal(50);

      // DATA_PUSHING with 1/2 written = 70%
      state.state = ORG_CREATION_STATES.DATA_PUSHING;
      state = markStoreDataWritten(state, STORE_TYPES.ORG_UID);
      summary = getStatusSummary(state);
      expect(summary.progress).to.equal(70); // 50 + 1/2 * 40 = 70

      // FINALIZING = 95%
      state.state = ORG_CREATION_STATES.FINALIZING;
      summary = getStatusSummary(state);
      expect(summary.progress).to.equal(95);

      // COMPLETE = 100%
      state.state = ORG_CREATION_STATES.COMPLETE;
      summary = getStatusSummary(state);
      expect(summary.progress).to.equal(100);

      // FAILED = -1
      state.state = ORG_CREATION_STATES.FAILED;
      summary = getStatusSummary(state);
      expect(summary.progress).to.equal(-1);
    });
  });
});
