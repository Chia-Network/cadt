import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { FilestoreV2 } from '../../../src/models/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

/**
 * Phase 19.1: FilestoreV2 Model Methods Tests
 *
 * Tests for FilestoreV2 model methods: getFile, getFileList, addFile, subscribe, unsubscribe, deleteFile
 */
describe('Phase 19.1: FilestoreV2 Model Methods', function () {
  this.timeout(30000);

  let testOrgUid;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Clean up any existing data
    await FilestoreV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  beforeEach(async function () {
    // Clean up filestore records before each test
    await FilestoreV2.destroy({ where: {} });
  });

  describe('Model Loading', function () {
    it('should load FilestoreV2 model successfully', async function () {
      expect(FilestoreV2).to.exist;
      expect(FilestoreV2).to.be.a('function');
    });

    it('should have all required static methods', async function () {
      expect(FilestoreV2.subscribeToFileStore).to.be.a('function');
      expect(FilestoreV2.unsubscribeFromFileStore).to.be.a('function');
      expect(FilestoreV2.addFileToFileStore).to.be.a('function');
      expect(FilestoreV2.getFileStoreList).to.be.a('function');
      expect(FilestoreV2.deleteFileStoreItem).to.be.a('function');
      expect(FilestoreV2.getFileStoreItem).to.be.a('function');
    });
  });

  describe('subscribeToFileStore', function () {
    it('should throw error if organization does not exist', async function () {
      try {
        await FilestoreV2.subscribeToFileStore('nonexistent-org-uid');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('does not exist');
      }
    });

    it('should throw error if organization does not have file store', async function () {
      // Create org without file store
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-no-filestore',
        name: 'Test Org No Filestore',
        icon: 'data:image/png;base64,test',
        is_home: false,
        file_store_subscribed: null,
      });

      try {
        await FilestoreV2.subscribeToFileStore(org.org_uid);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('does not have a file store');
      }

      // Cleanup
      await OrganizationsV2.destroy({ where: { org_uid: org.org_uid } });
    });
  });

  describe('unsubscribeFromFileStore', function () {
    it('should throw error if organization does not exist', async function () {
      try {
        await FilestoreV2.unsubscribeFromFileStore('nonexistent-org-uid');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('does not have a file store');
      }
    });
  });

  describe('getFileStoreList', function () {
    it('should throw error if no home org exists', async function () {
      // Delete home org temporarily
      await OrganizationsV2.destroy({ where: { is_home: true } });

      try {
        await FilestoreV2.getFileStoreList();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No home org detected');
      }

      // Restore home org
      await createV2TestHomeOrg();
    });
  });

  describe('addFileToFileStore', function () {
    it('should throw error if no home org exists', async function () {
      // Delete home org temporarily
      await OrganizationsV2.destroy({ where: { is_home: true } });

      try {
        await FilestoreV2.addFileToFileStore('test-sha256', 'test.txt', 'dGVzdA==');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No home org detected');
      }

      // Restore home org
      await createV2TestHomeOrg();
    });
  });

  describe('deleteFileStoreItem', function () {
    it('should throw error if no home org exists', async function () {
      // Delete home org temporarily
      await OrganizationsV2.destroy({ where: { is_home: true } });

      try {
        await FilestoreV2.deleteFileStoreItem('test-sha256');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No home org detected');
      }

      // Restore home org
      await createV2TestHomeOrg();
    });
  });

  describe('getFileStoreItem', function () {
    it('should throw error if no home org exists', async function () {
      // Delete home org temporarily
      await OrganizationsV2.destroy({ where: { is_home: true } });

      try {
        await FilestoreV2.getFileStoreItem('test-sha256');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No home org detected');
      }

      // Restore home org
      await createV2TestHomeOrg();
    });
  });
});

