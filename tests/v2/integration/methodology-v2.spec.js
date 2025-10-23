import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, MethodologyV2 } from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  waitForV2DataLayerSync,
} from '../utils/v2-test-helpers.js';

describe('V2 Methodology API - Basic CRUD Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    // Clean staging table before each test
    await resetV2StagingTable();
  });

  describe('POST /v2/methodology (Create)', function () {
        it('should create a new methodology record', async function () {
          const methodologyData = {
            methodologyCode: 'TEST-METHOD-001',
            methodologyName: 'Test Methodology',
            methodologyVersion: '1.0',
            methodologyDate: '2024-01-01',
            methodologyLink: 'https://example.com/methodology',
            methodologyType: 'Avoidance - nature',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(methodologyData);

          if (response.status !== 200) {
            console.log('Error response:', response.body);
          }

          expect(response.status).to.equal(200);
          expect(response.body).to.have.property('message');
          expect(response.body.message).to.equal('Methodology staged successfully');
          expect(response.body).to.have.property('uuid');
          expect(response.body).to.have.property('success', true);

          // Verify record was staged
          const stagingRecord = await StagingV2.findOne({
            where: { uuid: response.body.uuid },
          });
          expect(stagingRecord).to.exist;
          expect(stagingRecord.table).to.equal('methodology');
          expect(stagingRecord.action).to.equal('INSERT');
          expect(stagingRecord.commited).to.be.false;

          // Verify staged data
          const stagedData = JSON.parse(stagingRecord.data);
          expect(stagedData[0].methodology_code).to.equal('TEST-METHOD-001');
          expect(stagedData[0].methodology_name).to.equal('Test Methodology');
        });

        it('should create methodology with minimal data', async function () {
          const minimalData = {
            methodologyCode: 'MIN-001',
            methodologyName: 'Minimal Methodology',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(minimalData)
            .expect(200);

          expect(response.body.success).to.be.true;
          expect(response.body.uuid).to.exist;
        });

        // Validation tests
        it('should reject methodology without required methodologyCode', async function () {
          const invalidData = {
            methodologyName: 'Missing Code',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyCode');
        });

        it('should reject methodology without required methodologyName', async function () {
          const invalidData = {
            methodologyCode: 'MISSING-NAME',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyName');
        });

        it('should reject methodology with invalid methodologyDate format', async function () {
          const invalidData = {
            methodologyCode: 'INV-DATE',
            methodologyName: 'Invalid Date',
            methodologyDate: 'not-a-date',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyDate');
        });

        it('should reject methodology with invalid methodologyLink format', async function () {
          const invalidData = {
            methodologyCode: 'INV-LINK',
            methodologyName: 'Invalid Link',
            methodologyLink: 'not-a-valid-url',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyLink');
        });

        it('should reject methodology with invalid methodologyType (not in V2 picklist)', async function () {
          const invalidData = {
            methodologyCode: 'INV-TYPE',
            methodologyName: 'Invalid Type',
            methodologyType: 'InvalidType',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyType');
        });

        it('should accept methodology with valid V2 methodologyType', async function () {
          const validData = {
            methodologyCode: 'VALID-TYPE',
            methodologyName: 'Valid Type',
            methodologyType: 'Avoidance - nature',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(validData)
            .expect(200);

          expect(response.body.success).to.be.true;
          expect(response.body.uuid).to.exist;
        });
  });

  describe('GET /v2/methodology (List)', function () {
    it('should return empty array when no methodologies exist', async function () {
      // Clean up any existing data
      await MethodologyV2.destroy({ where: {} });

      const response = await supertest(app)
        .get('/v2/methodology')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return methodologies from database', async function () {
      // Create a methodology directly in database
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: 'test-uuid-123',
        methodologyCode: 'DB-METHOD-001',
        methodologyName: 'Database Methodology',
        methodologyVersion: '2.0',
      });

      const response = await supertest(app)
        .get('/v2/methodology')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].methodologyCode).to.equal('DB-METHOD-001');
      expect(response.body[0].methodologyName).to.equal('Database Methodology');
    });
  });

  describe('GET /v2/methodology/:id (Get One)', function () {
    it('should return 404 for non-existent methodology', async function () {
      const response = await supertest(app)
        .get('/v2/methodology/non-existent-id')
        .expect(404);

      expect(response.body.message).to.equal('Methodology not found');
      expect(response.body.success).to.be.false;
    });

    it('should return methodology by ID', async function () {
      // Create a methodology directly in database
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: 'test-uuid-456',
        methodologyCode: 'GET-METHOD-001',
        methodologyName: 'Get Test Methodology',
      });

      const response = await supertest(app)
        .get(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(200);

      expect(response.body.methodologyCode).to.equal('GET-METHOD-001');
      expect(response.body.methodologyName).to.equal('Get Test Methodology');
    });
  });

  describe('PUT /v2/methodology/:id (Update)', function () {
    it('should return 404 for non-existent methodology', async function () {
      const updateData = {
        methodologyName: 'Updated Name',
      };

      const response = await supertest(app)
        .put('/v2/methodology/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Methodology not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage methodology update', async function () {
      // Create a methodology directly in database
      const methodology = await MethodologyV2.create({
        methodologyCode: 'UPDATE-METHOD-001',
        methodologyName: 'Original Name',
      });

      const updateData = {
        methodologyCode: 'UPDATE-METHOD-001',
        methodologyName: 'Updated Name',
        methodologyVersion: '2.0',
      };

      const response = await supertest(app)
        .put(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .send(updateData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);

      expect(response.body.message).to.equal('Methodology update staged successfully');
      expect(response.body.success).to.be.true;

      // Verify update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'methodology',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_methodology_id).to.equal(methodology.cadTrustMethodologyId);
      expect(stagedData[0].methodology_name).to.equal('Updated Name');
      expect(stagedData[0].methodology_version).to.equal('2.0');
    });
  });

  describe('DELETE /v2/methodology/:id (Delete)', function () {
    it('should return 404 for non-existent methodology', async function () {
      const response = await supertest(app)
        .delete('/v2/methodology/non-existent-id')
        .expect(404);

      expect(response.body.message).to.equal('Methodology not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage methodology deletion', async function () {
      // Create a methodology directly in database
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: 'test-uuid-delete',
        methodologyCode: 'DELETE-METHOD-001',
        methodologyName: 'To Be Deleted',
      });

      const response = await supertest(app)
        .delete(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(200);

      expect(response.body.message).to.equal('Methodology delete staged successfully');
      expect(response.body.success).to.be.true;

      // Verify deletion was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'methodology',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_methodology_id).to.equal('test-uuid-delete');
    });
  });
});
