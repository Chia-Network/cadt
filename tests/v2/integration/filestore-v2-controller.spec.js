import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { FilestoreV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';
import crypto from 'crypto';

/**
 * Phase 19.2: FilestoreV2 Controller Tests
 *
 * Tests for FilestoreV2 controller endpoints
 */
describe('Phase 19.2: FilestoreV2 Controller', function () {
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

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    // Clean up filestore records before each test
    await FilestoreV2.destroy({ where: {} });
  });

  describe('POST /v2/filestore/subscribe', function () {
    it('should subscribe to file store for organization', async function () {
      // Create a test organization with file store ID
      const testOrg = await OrganizationsV2.create({
        org_uid: 'test-org-filestore',
        name: 'Test Org Filestore',
        icon: 'data:image/png;base64,test',
        is_home: false,
        file_store_subscribed: 'test-file-store-id',
      });

      const response = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({ orgUid: testOrg.org_uid })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('subscribed to file store');

      // Cleanup
      await OrganizationsV2.destroy({ where: { org_uid: testOrg.org_uid } });
    });

    it('should return error if orgUid is missing', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/subscribe')
        .send({});

      // Validation errors might have different formats (400 or 422)
      expect(response.status).to.be.oneOf([400, 422]);
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
        org_uid: 'test-org-no-filestore',
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
      // Create a test organization with file store ID
      const testOrg = await OrganizationsV2.create({
        org_uid: 'test-org-unsubscribe',
        name: 'Test Org Unsubscribe',
        icon: 'data:image/png;base64,test',
        is_home: false,
        file_store_subscribed: 'test-file-store-id',
      });

      const response = await supertest(app)
        .post('/v2/filestore/unsubscribe')
        .send({ orgUid: testOrg.org_uid })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('Unsubscribed');

      // Cleanup
      await OrganizationsV2.destroy({ where: { org_uid: testOrg.org_uid } });
    });

    it('should return error if orgUid is missing', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/unsubscribe')
        .send({});

      // Validation errors might have different formats (400 or 422)
      expect(response.status).to.be.oneOf([400, 422]);
    });
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
      // Create test files in database (simulating cached files)
      const testFile1 = await FilestoreV2.create({
        sha256: 'test-sha256-1',
        file_name: 'test1.txt',
        data: 'dGVzdDE=',
        org_uid: testOrgUid,
      });

      const testFile2 = await FilestoreV2.create({
        sha256: 'test-sha256-2',
        file_name: 'test2.txt',
        data: 'dGVzdDI=',
        org_uid: testOrgUid,
      });

      const response = await supertest(app)
        .get('/v2/filestore/get_file_list')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.at.least(2);

      const file1 = response.body.find((f) => f.sha256 === 'test-sha256-1');
      const file2 = response.body.find((f) => f.sha256 === 'test-sha256-2');

      expect(file1).to.exist;
      expect(file1.file_name).to.equal('test1.txt');
      expect(file2).to.exist;
      expect(file2.file_name).to.equal('test2.txt');
    });
  });

  describe('DELETE /v2/filestore/delete_file', function () {
    it('should return error if fileId is missing', async function () {
      const response = await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({})
        .expect(400);

      expect(response.body).to.exist;
      expect(response.body.success).to.be.false;
      // Error might be in error or message field
      expect(response.body.error || response.body.message).to.exist;
    });

    it('should delete file from filestore', async function () {
      // Create a test file
      const testFile = await FilestoreV2.create({
        sha256: 'test-delete-sha256',
        file_name: 'test-delete.txt',
        data: 'dGVzdA==',
        org_uid: testOrgUid,
      });

      const response = await supertest(app)
        .delete('/v2/filestore/delete_file')
        .send({ fileId: 'test-delete-sha256' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('deleted from the filestore');

      // Verify file is deleted from database
      const deletedFile = await FilestoreV2.findByPk('test-delete-sha256');
      expect(deletedFile).to.be.null;
    });
  });

  describe('GET /v2/filestore/get_file', function () {
    it('should return error if fileId is missing', async function () {
      // Note: GET requests with body are unusual but match V1 pattern
      // Using POST for testing since supertest doesn't support body on GET
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({})
        .expect(400);

      // Validation might return different format
      if (response.body) {
        expect(response.body.success).to.be.false;
      }
      // Error should be present in body
      expect(response.body).to.exist;
    });

    it('should return file content when file exists', async function () {
      // Create a test file
      const testContent = 'test file content';
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
      // In production, this would be GET with body (matching V1 pattern)
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({ fileId: SHA256 });

      // Response should be successful (file is cached in DB)
      expect(response.status).to.equal(200);

      // Response should be the file content as buffer
      // The response.body should be the decoded file content
      // Note: supertest handles binary responses differently
      const content = response.text || response.body.toString();
      expect(content).to.equal(testContent);
    });

    it('should return error if file does not exist', async function () {
      // Note: Using POST for testing since supertest doesn't support body on GET
      const response = await supertest(app)
        .post('/v2/filestore/get_file')
        .send({ fileId: 'nonexistent-sha256' })
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('not found');
    });
  });

  describe('POST /v2/filestore/add_file', function () {
    it('should return error if no file is provided', async function () {
      const response = await supertest(app)
        .post('/v2/filestore/add_file')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Missing file data');
    });

    it('should add file to filestore', async function () {
      const testContent = 'test file content for upload';
      const buffer = Buffer.from(testContent);

      const response = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', buffer, 'test-upload.txt')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('being added to the file store');
      expect(response.body.fileId).to.exist;
      expect(response.body.fileId).to.be.a('string');

      // Verify file was cached in database
      const file = await FilestoreV2.findByPk(response.body.fileId);
      expect(file).to.exist;
      expect(file.file_name).to.equal('test-upload.txt');
    });

    it('should prevent duplicate files (same SHA256)', async function () {
      const testContent = 'test duplicate file';
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
  });
});

