import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { FilestoreV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { FileStore } from '../../../src/models/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';
import crypto from 'crypto';

/**
 * Phase 19.4: FilestoreV2 Comprehensive Integration Tests
 *
 * Comprehensive integration tests for all filestore endpoints covering:
 * - GET /v2/filestore/get_file - Get file by ID
 * - GET /v2/filestore/get_file_list - List files
 * - POST /v2/filestore/add_file - Add file to filestore
 * - POST /v2/filestore/subscribe - Subscribe to filestore
 * - POST /v2/filestore/unsubscribe - Unsubscribe from filestore
 * - DELETE /v2/filestore/delete_file - Delete file
 * - Error handling - Invalid file ID, missing parameters
 * - V1/V2 isolation - Verify V2 filestore doesn't affect V1
 */
describe('Phase 19.4: FilestoreV2 Comprehensive Integration Tests', function () {
  this.timeout(30000);

  let testOrgUid;
  let testOrgUid2;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Clean up any existing data
    await FilestoreV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });
    await FileStore.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;

    // Create a second test organization for subscription tests
    const testOrg2 = await OrganizationsV2.create({
      org_uid: 'test-org-filestore-2',
      name: 'Test Org Filestore 2',
      icon: 'data:image/png;base64,test2',
      is_home: false,
      file_store_subscribed: 'test-file-store-id-2',
    });
    testOrgUid2 = testOrg2.org_uid;
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    // Clean up filestore records before each test
    await FilestoreV2.destroy({ where: {} });
    await FileStore.destroy({ where: {} });
  });

  describe('GET /v2/filestore/get_file_list', function () {
    it('should return empty list when no files exist', async function () {
      const response = await supertest(app)
        .get('/v2/filestore/get_file_list')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.be.empty;
    });

    it('should return list of files when files exist', async function () {
      // Create test files in database
      const testFile1 = await FilestoreV2.create({
        sha256: 'test-sha256-list-1',
        file_name: 'test-list-1.txt',
        data: 'dGVzdDE=',
        org_uid: testOrgUid,
      });

      const testFile2 = await FilestoreV2.create({
        sha256: 'test-sha256-list-2',
        file_name: 'test-list-2.txt',
        data: 'dGVzdDI=',
        org_uid: testOrgUid,
      });

      const response = await supertest(app)
        .get('/v2/filestore/get_file_list')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.at.least(2);

      const file1 = response.body.find((f) => f.sha256 === 'test-sha256-list-1');
      const file2 = response.body.find((f) => f.sha256 === 'test-sha256-list-2');

      expect(file1).to.exist;
      expect(file1.file_name).to.equal('test-list-1.txt');
      expect(file2).to.exist;
      expect(file2.file_name).to.equal('test-list-2.txt');
    });
  });

  describe('POST /v2/filestore/add_file', function () {
    it('should add file to filestore successfully', async function () {
      const testContent = 'test file content for add';
      const buffer = Buffer.from(testContent);

      const response = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'test-add.txt')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('being added to the file store');
      expect(response.body.fileId).to.exist;
      expect(response.body.fileId).to.be.a('string');

      // Verify file was cached in database
      const file = await FilestoreV2.findByPk(response.body.fileId);
      expect(file).to.exist;
      expect(file.file_name).to.equal('test-add.txt');
    });

    it('should prevent duplicate files (same SHA256)', async function () {
      const testContent = 'test duplicate file content';
      const buffer = Buffer.from(testContent);

      // First upload
      const response1 = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'test-duplicate-1.txt')
        .expect(200);

      expect(response1.body.success).to.be.true;
      const fileId = response1.body.fileId;

      // Second upload with same content (different filename)
      const response2 = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'test-duplicate-2.txt')
        .expect(400);

      expect(response2.body.success).to.be.false;
      expect(response2.body.error).to.include('File Already exists');
    });

    it('should return error if no file is provided', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/add_file')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Missing file data');
    });
  });

  describe('GET /v2/filestore/get_file', function () {
    it('should return file content when file exists', async function () {
      // Create a test file
      const testContent = 'test file content for get';
      const base64Content = Buffer.from(testContent).toString('base64');
      const SHA256 = crypto
        .createHash('sha256')
        .update(base64Content)
        .digest('base64');

      await FilestoreV2.create({
        sha256: SHA256,
        file_name: 'test-get.txt',
        data: base64Content,
        org_uid: testOrgUid,
      });

      // Note: Using POST for testing since supertest doesn't support body on GET
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({ fileId: SHA256 })
        .expect(200);

      // Response should be the file content as binary
      expect(response.text).to.equal(testContent);
    });

    it('should return error if fileId is missing', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({});

      expect([400, 422]).to.include(response.status);
    });

    it('should return error if file does not exist', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({ fileId: 'nonexistent-sha256' })
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('not found');
    });
  });

  describe('DELETE /v2/filestore/delete_file', function () {
    it('should delete file from filestore successfully', async function () {
      // Create a test file
      const testFile = await FilestoreV2.create({
        sha256: 'test-delete-sha256-comprehensive',
        file_name: 'test-delete.txt',
        data: 'dGVzdA==',
        org_uid: testOrgUid,
      });

      const response = await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({ fileId: 'test-delete-sha256-comprehensive' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('deleted from the filestore');

      // Verify file is deleted from database
      const deletedFile = await FilestoreV2.findByPk('test-delete-sha256-comprehensive');
      expect(deletedFile).to.be.null;
    });

    it('should return error if fileId is missing', async function () {
      const response = await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({});

      expect([400, 422]).to.include(response.status);
    });
  });

  describe('POST /v2/filestore/subscribe', function () {
    it('should subscribe to file store for organization', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({ orgUid: testOrgUid2 })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('subscribed to file store');
    });

    it('should return error if orgUid is missing', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({});

      expect([400, 422]).to.include(response.status);
    });

    it('should return error if organization does not exist', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({ orgUid: 'nonexistent-org' })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('does not exist');
    });

    it('should return error if organization does not have file store', async function () {
      // Create org without file store
      const testOrg = await OrganizationsV2.create({
        org_uid: 'test-org-no-filestore-comprehensive',
        name: 'Test Org No Filestore',
        icon: 'data:image/png;base64,test',
        is_home: false,
        file_store_subscribed: null,
      });

      const response = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({ orgUid: testOrg.org_uid })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('does not have a file store');

      // Cleanup
      await OrganizationsV2.destroy({ where: { org_uid: testOrg.org_uid } });
    });
  });

  describe('POST /v2/filestore/unsubscribe', function () {
    it('should unsubscribe from file store for organization', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/unsubscribe')
        .send({ orgUid: testOrgUid2 })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('Unsubscribed');
    });

    it('should return error if orgUid is missing', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/unsubscribe')
        .send({});

      expect([400, 422]).to.include(response.status);
    });
  });

  describe('Error Handling', function () {
    it('should handle invalid file ID gracefully', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({ fileId: 'invalid-sha256-format' })
        .expect(404);

      expect(response.body.success).to.be.false;
    });

    it('should handle missing required parameters', async function () {
      // Test missing fileId for delete
      const deleteResponse = await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({});

      expect([400, 422]).to.include(deleteResponse.status);

      // Test missing orgUid for subscribe
      const subscribeResponse = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({});

      expect([400, 422]).to.include(subscribeResponse.status);
    });
  });

  describe('V1/V2 Isolation Tests', function () {
    it('should verify V2 filestore operations work independently of V1', async function () {
      // Create V1 file store record
      const v1File = await FileStore.create({
        SHA256: 'v1-test-sha256',
        fileName: 'v1-test.txt',
        data: 'dGVzdA==',
        orgUid: 'v1-test-org',
      });

      // Create V2 file store record
      const testContent = 'v2 test file content';
      const buffer = Buffer.from(testContent);
      const v2Response = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'v2-test.txt')
        .expect(200);

      expect(v2Response.body.success).to.be.true;
      const v2FileId = v2Response.body.fileId;

      // Verify V2 file exists in V2 table
      const v2File = await FilestoreV2.findByPk(v2FileId);
      expect(v2File).to.exist;
      expect(v2File.file_name).to.equal('v2-test.txt');

      // Verify V1 file still exists and is unchanged
      const v1FileCheck = await FileStore.findByPk('v1-test-sha256');
      expect(v1FileCheck).to.exist;
      expect(v1FileCheck.fileName).to.equal('v1-test.txt');

      // Verify V2 file list doesn't include V1 files
      const v2FileList = await supertest(app)
        .get('/v2/filestore/get_file_list')
        .expect(200);

      const v1FileInV2List = v2FileList.body.find((f) => f.sha256 === 'v1-test-sha256');
      expect(v1FileInV2List).to.be.undefined;

      // Verify V2 file is not in V1 table
      const v2FileInV1 = await FileStore.findByPk(v2FileId);
      expect(v2FileInV1).to.be.null;
    });

    it('should verify V2 file operations do not affect V1 file store', async function () {
      // Create V1 file
      const v1File = await FileStore.create({
        SHA256: 'v1-isolation-test',
        fileName: 'v1-isolation.txt',
        data: 'dGVzdA==',
        orgUid: 'v1-test-org',
      });

      // Perform V2 operations
      const testContent = 'v2 isolation test';
      const buffer = Buffer.from(testContent);
      const v2Response = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'v2-isolation.txt')
        .expect(200);

      const v2FileId = v2Response.body.fileId;

      // Delete V2 file
      await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({ fileId: v2FileId })
        .expect(200);

      // Verify V1 file is still intact
      const v1FileCheck = await FileStore.findByPk('v1-isolation-test');
      expect(v1FileCheck).to.exist;
      expect(v1FileCheck.fileName).to.equal('v1-isolation.txt');

      // Verify V2 file is deleted
      const v2FileCheck = await FilestoreV2.findByPk(v2FileId);
      expect(v2FileCheck).to.be.null;
    });

    it('should verify V2 and V1 use separate database tables', async function () {
      // Create files in both systems
      const v1File = await FileStore.create({
        SHA256: 'v1-table-test',
        fileName: 'v1-table.txt',
        data: 'dGVzdA==',
        orgUid: 'v1-test-org',
      });

      const v2File = await FilestoreV2.create({
        sha256: 'v2-table-test',
        file_name: 'v2-table.txt',
        data: 'dGVzdA==',
        org_uid: testOrgUid,
      });

      // Verify they're in different tables
      const v1Count = await FileStore.count();
      const v2Count = await FilestoreV2.count();

      expect(v1Count).to.be.at.least(1);
      expect(v2Count).to.be.at.least(1);

      // Verify V1 file is not in V2 table
      const v1InV2 = await FilestoreV2.findByPk('v1-table-test');
      expect(v1InV2).to.be.null;

      // Verify V2 file is not in V1 table
      const v2InV1 = await FileStore.findByPk('v2-table-test');
      expect(v2InV1).to.be.null;
    });
  });

  describe('End-to-End Workflow Tests', function () {
    it('should complete full file lifecycle: add, list, get, delete', async function () {
      // Step 1: Add file
      const testContent = 'end-to-end test file';
      const buffer = Buffer.from(testContent);
      const addResponse = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'e2e-test.txt')
        .expect(200);

      expect(addResponse.body.success).to.be.true;
      const fileId = addResponse.body.fileId;

      // Step 2: List files (should include our file)
      const listResponse = await supertest(app)
        .get('/v2/filestore/get_file_list')
        .expect(200);

      const fileInList = listResponse.body.find((f) => f.sha256 === fileId);
      expect(fileInList).to.exist;
      expect(fileInList.file_name).to.equal('e2e-test.txt');

      // Step 3: Get file
      const getResponse = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({ fileId })
        .expect(200);

      expect(getResponse.text).to.equal(testContent);

      // Step 4: Delete file
      const deleteResponse = await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({ fileId })
        .expect(200);

      expect(deleteResponse.body.success).to.be.true;

      // Step 5: Verify file is gone
      const deletedFile = await FilestoreV2.findByPk(fileId);
      expect(deletedFile).to.be.null;
    });

    it('should handle subscribe and unsubscribe workflow', async function () {
      // Create test org with file store
      const testOrg = await OrganizationsV2.create({
        org_uid: 'test-org-e2e',
        name: 'Test Org E2E',
        icon: 'data:image/png;base64,test',
        is_home: false,
        file_store_subscribed: 'test-file-store-e2e',
      });

      // Subscribe
      const subscribeResponse = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({ orgUid: testOrg.org_uid })
        .expect(200);

      expect(subscribeResponse.body.success).to.be.true;

      // Unsubscribe
      const unsubscribeResponse = await supertest(app)
        .post('/v2/filestore/unsubscribe')
        .send({ orgUid: testOrg.org_uid })
        .expect(200);

      expect(unsubscribeResponse.body.success).to.be.true;

      // Cleanup
      await OrganizationsV2.destroy({ where: { org_uid: testOrg.org_uid } });
    });
  });
});

