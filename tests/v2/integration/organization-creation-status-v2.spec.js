import { expect } from 'chai';
import sinon from 'sinon';
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
  hasInProgressCreation,
  getStatusSummary,
  markStoreCreated,
  markStoreConfirmed,
  markStoreDataWritten,
  STORE_TYPES,
  createIncrementalStateWriter,
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

    it('should detect timed-out creation as NOT in progress (V2)', async function () {
      const state = createInitialState('Stale Org', '', 'v2', 'v2');
      // Backdate startedAt to exceed the timeout
      state.startedAt = new Date(
        Date.now() - ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS - 60000,
      ).toISOString();
      await saveCreationState(state, MetaV2);

      const inProgress = await hasInProgressCreation(MetaV2, 'v2');
      expect(inProgress).to.be.false;
    });

    it('should detect timed-out creation as NOT in progress (V1)', async function () {
      const state = createInitialState('Stale Org', '', 'v1', 'v1');
      state.startedAt = new Date(
        Date.now() - ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS - 60000,
      ).toISOString();
      await saveCreationState(state, Meta);

      const inProgress = await hasInProgressCreation(Meta, 'v1');
      expect(inProgress).to.be.false;
    });

    it('should detect recent creation as in progress', async function () {
      const state = createInitialState('Fresh Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(state, MetaV2);

      const inProgress = await hasInProgressCreation(MetaV2, 'v2');
      expect(inProgress).to.be.true;
    });

    it('should NOT detect FAILED state as in progress', async function () {
      const state = createInitialState('Failed Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.FAILED;
      state.error = 'Some error';
      await saveCreationState(state, MetaV2);

      const inProgress = await hasInProgressCreation(MetaV2, 'v2');
      expect(inProgress).to.be.false;
    });
  });

  describe('createIncrementalStateWriter', function () {
    it('should persist each store creation immediately so partial progress is visible', async function () {
      // Simulates the production race: 4 parallel store-creation promises
      // resolve at different times, and the live-api stuck-state detector
      // polls the creation-status endpoint between them. With the writer,
      // each completion makes the next poll see new progress and reset
      // the detector's timer.
      const initialState = createInitialState('Incremental V2 Org', '', 'v2', 'v2');
      initialState.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(initialState, MetaV2);

      const writer = createIncrementalStateWriter(initialState, MetaV2);

      const storeIds = {
        [STORE_TYPES.ORG_UID]: 'orgUid-id',
        [STORE_TYPES.REGISTRY]: 'registry-id',
        [STORE_TYPES.DATA_MODEL_VERSION]: 'dataModelVersion-id',
        [STORE_TYPES.FILE_STORE]: 'fileStore-id',
      };
      const orderOfCompletion = [
        STORE_TYPES.REGISTRY,
        STORE_TYPES.DATA_MODEL_VERSION,
        STORE_TYPES.ORG_UID,
        STORE_TYPES.FILE_STORE,
      ];

      const persistedAfterEach = [];
      for (const storeType of orderOfCompletion) {
        await writer.persistStoreCreated(storeType, storeIds[storeType]);
        const persisted = await loadCreationState(MetaV2, 'v2');
        persistedAfterEach.push(persisted);
      }

      // After 1st write the registry is set and the rest are still null.
      expect(persistedAfterEach[0].stores[STORE_TYPES.REGISTRY].id).to.equal('registry-id');
      expect(persistedAfterEach[0].stores[STORE_TYPES.ORG_UID].id).to.be.null;
      expect(persistedAfterEach[0].stores[STORE_TYPES.DATA_MODEL_VERSION].id).to.be.null;
      expect(persistedAfterEach[0].stores[STORE_TYPES.FILE_STORE].id).to.be.null;

      // After 2nd write registry + dataModelVersion are set.
      expect(persistedAfterEach[1].stores[STORE_TYPES.REGISTRY].id).to.equal('registry-id');
      expect(persistedAfterEach[1].stores[STORE_TYPES.DATA_MODEL_VERSION].id).to.equal('dataModelVersion-id');
      expect(persistedAfterEach[1].stores[STORE_TYPES.ORG_UID].id).to.be.null;
      expect(persistedAfterEach[1].stores[STORE_TYPES.FILE_STORE].id).to.be.null;

      // After 3rd write three of four are set.
      expect(persistedAfterEach[2].stores[STORE_TYPES.ORG_UID].id).to.equal('orgUid-id');
      expect(persistedAfterEach[2].stores[STORE_TYPES.FILE_STORE].id).to.be.null;

      // Final state: all four set, in-memory and persisted match.
      const final = persistedAfterEach[3];
      expect(final.stores[STORE_TYPES.ORG_UID].id).to.equal('orgUid-id');
      expect(final.stores[STORE_TYPES.REGISTRY].id).to.equal('registry-id');
      expect(final.stores[STORE_TYPES.DATA_MODEL_VERSION].id).to.equal('dataModelVersion-id');
      expect(final.stores[STORE_TYPES.FILE_STORE].id).to.equal('fileStore-id');

      const current = writer.getCurrent();
      expect(current.stores[STORE_TYPES.ORG_UID].id).to.equal('orgUid-id');
      expect(current.stores[STORE_TYPES.REGISTRY].id).to.equal('registry-id');
      expect(current.stores[STORE_TYPES.DATA_MODEL_VERSION].id).to.equal('dataModelVersion-id');
      expect(current.stores[STORE_TYPES.FILE_STORE].id).to.equal('fileStore-id');
    });

    it('should preserve all updates when persistStoreCreated calls are awaited in Promise.all', async function () {
      // Sanity check that running the four writes in parallel via
      // Promise.all does not lose any of them and that both the
      // in-memory and persisted views agree at the end. This isn't a
      // strict regression guard against removing the mutex (single-
      // threaded JS plus serialised SQLite writes would still produce
      // the same final state in many cases), but it does protect
      // against any future change that reorders the snapshot/persist
      // steps such that an early failure would leave a fake storeId
      // in the in-memory state.
      const initialState = createInitialState('Concurrent V2 Org', '', 'v2', 'v2');
      initialState.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(initialState, MetaV2);

      const writer = createIncrementalStateWriter(initialState, MetaV2);

      await Promise.all([
        writer.persistStoreCreated(STORE_TYPES.ORG_UID, 'concurrent-org-uid'),
        writer.persistStoreCreated(STORE_TYPES.REGISTRY, 'concurrent-registry'),
        writer.persistStoreCreated(STORE_TYPES.DATA_MODEL_VERSION, 'concurrent-dmv'),
        writer.persistStoreCreated(STORE_TYPES.FILE_STORE, 'concurrent-filestore'),
      ]);

      const current = writer.getCurrent();
      expect(current.stores[STORE_TYPES.ORG_UID].id).to.equal('concurrent-org-uid');
      expect(current.stores[STORE_TYPES.REGISTRY].id).to.equal('concurrent-registry');
      expect(current.stores[STORE_TYPES.DATA_MODEL_VERSION].id).to.equal('concurrent-dmv');
      expect(current.stores[STORE_TYPES.FILE_STORE].id).to.equal('concurrent-filestore');

      const persisted = await loadCreationState(MetaV2, 'v2');
      expect(persisted.stores[STORE_TYPES.ORG_UID].id).to.equal('concurrent-org-uid');
      expect(persisted.stores[STORE_TYPES.REGISTRY].id).to.equal('concurrent-registry');
      expect(persisted.stores[STORE_TYPES.DATA_MODEL_VERSION].id).to.equal('concurrent-dmv');
      expect(persisted.stores[STORE_TYPES.FILE_STORE].id).to.equal('concurrent-filestore');
    });

    it('should NOT update stateRef.current when saveCreationState fails', async function () {
      // Ensures the writer keeps its in-memory state in sync with what
      // is on disk: if persistence throws, the storeId we just tried to
      // record is NOT silently kept in stateRef.current. This is what
      // lets a caller treat a failed persist as "store creation failed"
      // without leaking a half-applied update.
      const initialState = createInitialState('Failing Persist Org', '', 'v2', 'v2');
      initialState.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(initialState, MetaV2);

      const writer = createIncrementalStateWriter(initialState, MetaV2);

      const failingMeta = {
        findOne: async () => { throw new Error('simulated DB outage'); },
        update: async () => { throw new Error('simulated DB outage'); },
        create: async () => { throw new Error('simulated DB outage'); },
      };
      const failingWriter = createIncrementalStateWriter(initialState, failingMeta);

      try {
        await failingWriter.persistStoreCreated(STORE_TYPES.ORG_UID, 'should-not-leak');
        expect.fail('persistStoreCreated should have thrown');
      } catch (e) {
        expect(e.message).to.include('simulated DB outage');
      }

      // In-memory state must not contain the un-persisted storeId.
      expect(failingWriter.getCurrent().stores[STORE_TYPES.ORG_UID].id).to.be.null;

      // Original successful writer is unaffected.
      await writer.persistStoreCreated(STORE_TYPES.ORG_UID, 'good-id');
      expect(writer.getCurrent().stores[STORE_TYPES.ORG_UID].id).to.equal('good-id');
      const persisted = await loadCreationState(MetaV2, 'v2');
      expect(persisted.stores[STORE_TYPES.ORG_UID].id).to.equal('good-id');
    });

    it('should also work for V1 (Meta model)', async function () {
      const initialState = createInitialState('Incremental V1 Org', '', 'v1', 'v1');
      initialState.state = ORG_CREATION_STATES.STORES_CREATING;
      await saveCreationState(initialState, Meta);

      const writer = createIncrementalStateWriter(initialState, Meta);

      await writer.persistStoreCreated(STORE_TYPES.ORG_UID, 'v1-org-uid');
      let persisted = await loadCreationState(Meta, 'v1');
      expect(persisted.stores[STORE_TYPES.ORG_UID].id).to.equal('v1-org-uid');
      expect(persisted.stores[STORE_TYPES.REGISTRY].id).to.be.null;

      await writer.persistStoreCreated(STORE_TYPES.REGISTRY, 'v1-registry');
      persisted = await loadCreationState(Meta, 'v1');
      expect(persisted.stores[STORE_TYPES.ORG_UID].id).to.equal('v1-org-uid');
      expect(persisted.stores[STORE_TYPES.REGISTRY].id).to.equal('v1-registry');
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

      // Wait for org creation to complete (poll for a non-PENDING org).
      // The creation flow first inserts a PENDING record (name: '', orgUid: 'PENDING')
      // then replaces it with the real record upon finalization.
      let org = null;
      for (let attempt = 1; attempt <= 40; attempt++) {
        const candidate = await Organization.findOne({ where: { isHome: true }, raw: true });
        if (candidate && candidate.orgUid !== 'PENDING') {
          org = candidate;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
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

  describe('Error Recovery - State marked FAILED on failure', function () {
    afterEach(function () {
      sinon.restore();
    });

    it('should mark V2 state as FAILED when _executeOrganizationCreation throws', async function () {
      sinon.stub(OrganizationsV2, '_executeOrganizationCreation')
        .rejects(new Error('simulated store creation failure'));

      try {
        await OrganizationsV2.createHomeOrganization('FailTest V2', '', 'v2');
        expect.fail('createHomeOrganization should have thrown');
      } catch (e) {
        expect(e.message).to.equal('simulated store creation failure');
      }

      const failedState = await loadCreationState(MetaV2, 'v2');
      expect(failedState).to.exist;
      expect(failedState.state).to.equal(ORG_CREATION_STATES.FAILED);
      expect(failedState.error).to.include('simulated store creation failure');

      const pendingOrg = await OrganizationsV2.findOne({
        where: { org_uid: 'PENDING' },
        raw: true,
      });
      expect(pendingOrg).to.be.null;
    });

    it('should mark V1 state as FAILED when _executeOrganizationCreation throws', async function () {
      sinon.stub(Organization, '_executeOrganizationCreation')
        .rejects(new Error('simulated V1 store failure'));

      try {
        await Organization.createHomeOrganization('FailTest V1', '', 'v1');
        expect.fail('createHomeOrganization should have thrown');
      } catch (e) {
        expect(e.message).to.equal('simulated V1 store failure');
      }

      const failedState = await loadCreationState(Meta, 'v1');
      expect(failedState).to.exist;
      expect(failedState.state).to.equal(ORG_CREATION_STATES.FAILED);
      expect(failedState.error).to.include('simulated V1 store failure');

      const pendingOrg = await Organization.findOne({
        where: { orgUid: 'PENDING' },
        raw: true,
      });
      expect(pendingOrg).to.be.null;
    });
  });

  describe('Error Recovery - getStatusSummary stale detection', function () {
    it('should report timed-out INITIALIZING state as not in progress', function () {
      const state = createInitialState('Stale Org', '', 'v2', 'v2');
      state.startedAt = new Date(
        Date.now() - ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS - 60000,
      ).toISOString();

      const summary = getStatusSummary(state);
      expect(summary.inProgress).to.be.false;
      expect(summary.progress).to.equal(-1);
      expect(summary.message).to.include('stale');
    });

    it('should report timed-out STORES_CREATING state as not in progress', function () {
      const state = createInitialState('Stale Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.STORES_CREATING;
      state.startedAt = new Date(
        Date.now() - ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS - 60000,
      ).toISOString();

      const summary = getStatusSummary(state);
      expect(summary.inProgress).to.be.false;
      expect(summary.progress).to.equal(-1);
      expect(summary.state).to.equal(ORG_CREATION_STATES.STORES_CREATING);
    });

    it('should NOT report FAILED state as stale even if timed out', function () {
      const state = createInitialState('Failed Org', '', 'v2', 'v2');
      state.state = ORG_CREATION_STATES.FAILED;
      state.error = 'Previous failure';
      state.startedAt = new Date(
        Date.now() - ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS - 60000,
      ).toISOString();

      const summary = getStatusSummary(state);
      expect(summary.inProgress).to.be.false;
      expect(summary.message).to.not.include('stale');
      expect(summary.message).to.include('failed');
    });
  });

  describe('Error Recovery - Creation after previous failure', function () {
    it('should create V2 org after previous FAILED state', async function () {
      if (!USE_SIMULATOR) {
        this.skip();
      }

      const failedState = createInitialState('Old Failed Org', '', 'v2', 'v2');
      failedState.state = ORG_CREATION_STATES.FAILED;
      failedState.error = 'Previous attempt failed';
      await saveCreationState(failedState, MetaV2);

      const response = await supertest(app)
        .post('/v2/organizations')
        .send({ name: 'Recovery Org V2', icon: '' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.orgUid).to.exist;

      await new Promise(resolve => setTimeout(resolve, 100));

      const org = await OrganizationsV2.findOne({ where: { is_home: true }, raw: true });
      expect(org).to.exist;
      expect(org.name).to.equal('Recovery Org V2');
    });

    it('should create V1 org after previous FAILED state', async function () {
      if (!USE_SIMULATOR) {
        this.skip();
      }

      const failedState = createInitialState('Old Failed Org', '', 'v1', 'v1');
      failedState.state = ORG_CREATION_STATES.FAILED;
      failedState.error = 'Previous attempt failed';
      await saveCreationState(failedState, Meta);

      const response = await supertest(app)
        .post('/v1/organizations')
        .send({ name: 'Recovery Org V1', icon: '' });

      expect(response.status).to.not.equal(409);
      expect(response.body.success).to.be.true;

      let org = null;
      for (let attempt = 1; attempt <= 40; attempt++) {
        const candidate = await Organization.findOne({ where: { isHome: true }, raw: true });
        if (candidate && candidate.orgUid !== 'PENDING') {
          org = candidate;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      expect(org).to.exist;
      expect(org.name).to.equal('Recovery Org V1');
    });
  });
});
