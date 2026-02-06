import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

/**
 * File Upload Size Limit Tests
 *
 * Tests to verify that Multer file size limits are properly enforced:
 * - Organization icons: 2MB limit
 * - File store uploads: 100MB limit
 * - Batch/XLSX uploads: 25MB limit
 * - Offer file imports: 5MB limit
 *
 * These tests verify:
 * 1. Files within limits are accepted
 * 2. Files exceeding limits are rejected with 413 status
 * 3. Error messages are clear and user-friendly
 */
describe('File Upload Size Limit Tests', function () {
  this.timeout(30000);

  let testOrgUid;

  before(async function () {
    console.log('Setting up V2 test environment for file upload limits...');
    await prepareV2Db();
    await OrganizationsV2.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
  });

  /**
   * Helper function to create a buffer of specified size
   * @param {number} sizeInBytes - Size of buffer to create
   * @returns {Buffer} - Buffer filled with 'x' characters
   */
  function createBufferOfSize(sizeInBytes) {
    return Buffer.alloc(sizeInBytes, 'x');
  }

  describe('Organization Icon Upload Limits (2MB)', function () {
    const TWO_MB = 2 * 1024 * 1024;

    it('should accept icon file under 2MB limit', async function () {
      // Create a small file (1KB)
      const smallBuffer = createBufferOfSize(1024);

      // Use PUT /v2/organizations/edit for editing home org with icon
      const response = await supertest(app)
        .put('/v2/organizations/edit')
        .attach('file', smallBuffer, 'small-icon.png')
        .field('name', 'Test Org Updated');

      // Should not get a 413 error - may get other errors but not size limit
      expect(response.status).to.not.equal(413);
    });

    it('should reject icon file exceeding 2MB limit', async function () {
      // Create a file larger than 2MB
      const largeBuffer = createBufferOfSize(TWO_MB + 1024);

      const response = await supertest(app)
        .put('/v2/organizations/edit')
        .attach('file', largeBuffer, 'large-icon.png')
        .field('name', 'Test Org Updated');

      expect(response.status).to.equal(413);
      expect(response.body.message).to.include('File too large');
      expect(response.body.message).to.include('2MB');
      expect(response.body.error).to.equal('LIMIT_FILE_SIZE');
      expect(response.body.success).to.be.false;
    });

    it('should accept icon file just under 2MB limit', async function () {
      // Create a file just under the limit (1 byte less than 2MB)
      // Note: Multer's limit is exclusive, so exactly 2MB would be rejected
      const justUnderBuffer = createBufferOfSize(TWO_MB - 1);

      const response = await supertest(app)
        .put('/v2/organizations/edit')
        .attach('file', justUnderBuffer, 'almost-max-icon.png')
        .field('name', 'Test Org Updated');

      // Should not get a 413 error
      expect(response.status).to.not.equal(413);
    });
  });

  describe('File Store Upload Limits (100MB)', function () {
    const HUNDRED_MB = 100 * 1024 * 1024;

    it('should accept file under 100MB limit', async function () {
      // Create a small file (1KB)
      const smallBuffer = createBufferOfSize(1024);

      const response = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', smallBuffer, 'small-file.txt');

      // Should not get a 413 error
      expect(response.status).to.not.equal(413);
    });

    it('should reject file exceeding 100MB limit', async function () {
      // Note: Creating a 100MB+ buffer in memory is expensive
      // We'll create a smaller buffer that still exceeds the limit for testing
      // In a real scenario, this would be 100MB+

      // Skip this test in CI environments due to memory constraints
      if (process.env.CI) {
        this.skip();
        return;
      }

      const largeBuffer = createBufferOfSize(HUNDRED_MB + 1024);

      const response = await supertest(app)
        .post('/v2/filestore/add_file')
        .attach('file', largeBuffer, 'large-file.txt');

      expect(response.status).to.equal(413);
      expect(response.body.message).to.include('File too large');
      expect(response.body.message).to.include('100MB');
      expect(response.body.error).to.equal('LIMIT_FILE_SIZE');
      expect(response.body.success).to.be.false;
    });
  });

  describe('Batch/XLSX Upload Limits (25MB)', function () {
    const TWENTY_FIVE_MB = 25 * 1024 * 1024;

    it('should accept CSV file under 25MB limit', async function () {
      // Create a small CSV file
      const csvContent = 'column1,column2\nvalue1,value2';
      const smallBuffer = Buffer.from(csvContent);

      const response = await supertest(app)
        .post('/v2/project/batch')
        .attach('csv', smallBuffer, 'small-batch.csv');

      // Should not get a 413 error - may get validation errors but not size limit
      expect(response.status).to.not.equal(413);
    });

    it('should reject CSV file exceeding 25MB limit', async function () {
      // Create a file larger than 25MB
      const largeBuffer = createBufferOfSize(TWENTY_FIVE_MB + 1024);

      const response = await supertest(app)
        .post('/v2/project/batch')
        .attach('csv', largeBuffer, 'large-batch.csv');

      expect(response.status).to.equal(413);
      expect(response.body.message).to.include('File too large');
      expect(response.body.message).to.include('25MB');
      expect(response.body.error).to.equal('LIMIT_FILE_SIZE');
      expect(response.body.success).to.be.false;
    });

    it('should accept XLSX file under 25MB limit', async function () {
      // Create a small buffer representing an XLSX file
      const smallBuffer = createBufferOfSize(1024);

      const response = await supertest(app)
        .put('/v2/project/xlsx')
        .attach('xlsx', smallBuffer, 'small-update.xlsx');

      // Should not get a 413 error
      expect(response.status).to.not.equal(413);
    });

    it('should reject XLSX file exceeding 25MB limit', async function () {
      // Create a file larger than 25MB
      const largeBuffer = createBufferOfSize(TWENTY_FIVE_MB + 1024);

      const response = await supertest(app)
        .put('/v2/project/xlsx')
        .attach('xlsx', largeBuffer, 'large-update.xlsx');

      expect(response.status).to.equal(413);
      expect(response.body.message).to.include('File too large');
      expect(response.body.message).to.include('25MB');
      expect(response.body.error).to.equal('LIMIT_FILE_SIZE');
      expect(response.body.success).to.be.false;
    });

    it('should enforce limits on unit batch uploads', async function () {
      // Create a file larger than 25MB
      const largeBuffer = createBufferOfSize(TWENTY_FIVE_MB + 1024);

      const response = await supertest(app)
        .post('/v2/unit/batch')
        .attach('csv', largeBuffer, 'large-unit-batch.csv');

      expect(response.status).to.equal(413);
      expect(response.body.message).to.include('File too large');
      expect(response.body.error).to.equal('LIMIT_FILE_SIZE');
      expect(response.body.success).to.be.false;
    });
  });

  describe('Offer File Import Limits (5MB)', function () {
    const FIVE_MB = 5 * 1024 * 1024;

    it('should accept offer file under 5MB limit', async function () {
      // Create a small file
      const smallBuffer = createBufferOfSize(1024);

      const response = await supertest(app)
        .post('/v2/offer/accept/import')
        .attach('file', smallBuffer, 'small-offer.json');

      // Should not get a 413 error - may get other validation errors
      expect(response.status).to.not.equal(413);
    });

    it('should reject offer file exceeding 5MB limit', async function () {
      // Create a file larger than 5MB
      const largeBuffer = createBufferOfSize(FIVE_MB + 1024);

      const response = await supertest(app)
        .post('/v2/offer/accept/import')
        .attach('file', largeBuffer, 'large-offer.json');

      expect(response.status).to.equal(413);
      expect(response.body.message).to.include('File too large');
      expect(response.body.message).to.include('5MB');
      expect(response.body.error).to.equal('LIMIT_FILE_SIZE');
      expect(response.body.success).to.be.false;
    });
  });

  describe('Error Message Quality', function () {
    it('should provide user-friendly error message for oversized organization icon', async function () {
      const largeBuffer = createBufferOfSize(3 * 1024 * 1024); // 3MB

      const response = await supertest(app)
        .put('/v2/organizations/edit')
        .attach('file', largeBuffer, 'oversized-icon.png')
        .field('name', 'Test Org');

      expect(response.status).to.equal(413);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('error');
      expect(response.body).to.have.property('success');
      expect(response.body.success).to.be.false;
      // Message should be descriptive
      expect(response.body.message).to.include('File too large');
      expect(response.body.message).to.include('Maximum file size');
    });

    it('should include route-specific limit information in error message', async function () {
      // Test organization route - should mention 2MB for icons
      const iconBuffer = createBufferOfSize(3 * 1024 * 1024);
      const iconResponse = await supertest(app)
        .put('/v2/organizations/edit')
        .attach('file', iconBuffer, 'icon.png')
        .field('name', 'Test');

      expect(iconResponse.status).to.equal(413);
      expect(iconResponse.body.message).to.include('2MB');
      expect(iconResponse.body.message).to.include('organization icons');

      // Test offer route - should mention 5MB for offer files
      const offerBuffer = createBufferOfSize(6 * 1024 * 1024);
      const offerResponse = await supertest(app)
        .post('/v2/offer/accept/import')
        .attach('file', offerBuffer, 'offer.json');

      expect(offerResponse.status).to.equal(413);
      expect(offerResponse.body.message).to.include('5MB');
      expect(offerResponse.body.message).to.include('offer files');
    });
  });
});
