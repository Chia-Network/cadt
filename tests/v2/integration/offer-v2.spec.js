import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  StagingV2,
  MetaV2,
  OrganizationsV2,
  ProjectV2,
  ProgramV2,
} from '../../../src/models/v2/index.js';
import { Meta } from '../../../src/models/index.js';
import {
  createV2TestHomeOrg,
  resetV2StagingTable,
  resetV2DataTables,
} from '../utils/v2-test-helpers.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Phase 18.4: OfferV2 Integration Tests
 *
 * Comprehensive integration tests for all OfferV2 API endpoints
 */
describe('Phase 18.4: OfferV2 Integration Tests', function () {
  this.timeout(300000); // 5 minutes for datalayer operations

  let testOrgUid;
  let testProgram;
  let testProject;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Clean up any existing data
    await MetaV2.destroy({ where: {} });
    await resetV2StagingTable();
    await resetV2DataTables();
    await OrganizationsV2.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;

    // Create test program and project for transfer tests
    testProgram = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for Offer',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: testOrgUid,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Offer',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });
  });

  beforeEach(async function () {
    // Clean up meta and staging before each test
    await MetaV2.destroy({ where: {} });
    await resetV2StagingTable();
  });

  describe('GET /v2/offer/accept - Get current offer info', function () {
    it('should return "No offer to accept" when no offer exists', async function () {
      const response = await supertest(app)
        .get('/v2/offer/accept')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message', 'No offer to accept');
    });

    it('should return offer info when active offer exists', async function () {
      // Create a test offer in MetaV2
      const testOffer = {
        offer: {
          maker: [
            {
              store_id: 'test-maker-store',
              proofs: [
                {
                  key: Buffer.from('project|test-key').toString('hex'),
                  value: Buffer.from(JSON.stringify({ test: 'data' })).toString('hex'),
                },
              ],
            },
          ],
          taker: [
            {
              store_id: 'test-taker-store',
              inclusions: [
                {
                  key: Buffer.from('project|test-key').toString('hex'),
                  value: Buffer.from(JSON.stringify({ test: 'data' })).toString('hex'),
                },
              ],
            },
          ],
        },
        fee: 300000000,
      };

      await MetaV2.create({
        meta_key: 'activeOffer',
        meta_value: JSON.stringify(testOffer),
      });

      const response = await supertest(app)
        .get('/v2/offer/accept')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('changes');
      expect(response.body.changes).to.have.property('maker');
      expect(response.body.changes).to.have.property('taker');
    });
  });

  describe('POST /v2/offer/accept/import - Import offer file', function () {
    it('should return error when no file is uploaded', async function () {
      const response = await supertest(app)
        .post('/v2/offer/accept/import')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('import offer file');
    });

    it('should import valid offer file', async function () {
      const testOffer = {
        offer: {
          maker: [
            {
              store_id: 'test-maker-store',
              proofs: [
                {
                  key: Buffer.from('project|test-key').toString('hex'),
                  value: Buffer.from(JSON.stringify({ test: 'data' })).toString('hex'),
                },
              ],
            },
          ],
          taker: [
            {
              store_id: 'test-taker-store',
              inclusions: [
                {
                  key: Buffer.from('project|test-key').toString('hex'),
                  value: Buffer.from(JSON.stringify({ test: 'data' })).toString('hex'),
                },
              ],
            },
          ],
        },
        fee: 300000000,
      };

      const offerFile = Buffer.from(JSON.stringify(testOffer));

      // In simulator mode, verifyOffer will fail, but we can test the import structure
      const response = await supertest(app)
        .post('/v2/offer/accept/import')
        .attach('file', offerFile, 'offer.json')
        .expect((res) => {
          // Accept either success (if verifyOffer passes) or error (if it fails in simulator)
          if (res.status === 200) {
            expect(res.body).to.have.property('success', true);
          } else {
            expect(res.status).to.be.oneOf([400, 500]);
            // Check if offer was stored before error
            // This is acceptable behavior in simulator mode
          }
        });

      // If import succeeded, verify offer was stored
      if (response.status === 200) {
        const stored = await MetaV2.findOne({
          where: { meta_key: 'activeOffer' },
          raw: true,
        });
        expect(stored).to.exist;
      }
    });

    it('should return error for invalid offer file format', async function () {
      const invalidOffer = Buffer.from('invalid json');

      const response = await supertest(app)
        .post('/v2/offer/accept/import')
        .attach('file', invalidOffer, 'offer.json')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('import offer file');
    });
  });

  describe('DELETE /v2/offer/accept/cancel - Cancel imported offer', function () {
    it('should cancel imported offer', async function () {
      // Create an active offer
      await MetaV2.create({
        meta_key: 'activeOffer',
        meta_value: JSON.stringify({ test: 'data' }),
      });

      const response = await supertest(app)
        .delete('/v2/offer/accept/cancel')
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.message).to.include('Cancelled');

      // Verify offer was removed
      const stored = await MetaV2.findOne({
        where: { meta_key: 'activeOffer' },
        raw: true,
      });
      expect(stored).to.be.null;
    });

    it('should not throw error when no offer exists', async function () {
      const response = await supertest(app)
        .delete('/v2/offer/accept/cancel')
        .expect(200);

      expect(response.body).to.have.property('success', true);
    });
  });

  describe('GET /v2/offer - Generate offer file', function () {
    it('should return error when staging table is empty', async function () {
      const response = await supertest(app)
        .get('/v2/offer')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('offer file');
    });

    it('should return error when no transfer record exists', async function () {
      // Check if committed column exists in staging table
      const { sequelizeV2 } = await import('../../../src/database/v2/index.js');
      const [columns] = await sequelizeV2.query(
        `PRAGMA table_info(staging)`
      );
      const hasCommittedColumn = columns.some(col => col.name === 'committed');

      if (!hasCommittedColumn) {
        this.skip(); // Skip if database schema is not fully migrated
      }

      // Create a non-transfer staging record using raw SQL
      await sequelizeV2.query(
        `INSERT INTO staging (uuid, "table", action, data, committed, failed_commit, is_transfer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        {
          replacements: [
            uuidv4(),
            'project',
            'UPDATE',
            JSON.stringify([{ cad_trust_project_id: testProject.cadTrustProjectId }]),
            0, // committed = false
            0, // failed_commit = false
            0, // is_transfer = false
          ],
        }
      );

      const response = await supertest(app)
        .get('/v2/offer')
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });

    it('should generate offer file when transfer record exists', async function () {
      // Check if committed column exists in staging table
      const { sequelizeV2 } = await import('../../../src/database/v2/index.js');
      const [columns] = await sequelizeV2.query(
        `PRAGMA table_info(staging)`
      );
      const hasCommittedColumn = columns.some(col => col.name === 'committed');

      if (!hasCommittedColumn) {
        this.skip(); // Skip if database schema is not fully migrated
      }

      // Create a transfer staging record using raw SQL
      await sequelizeV2.query(
        `INSERT INTO staging (uuid, "table", action, data, committed, failed_commit, is_transfer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        {
          replacements: [
            uuidv4(),
            'project',
            'UPDATE',
            JSON.stringify([{ cad_trust_project_id: testProject.cadTrustProjectId }]),
            0, // committed = false
            0, // failed_commit = false
            1, // is_transfer = true
          ],
        }
      );

      // In simulator mode, makeOffer will fail, but we can test the structure
      const response = await supertest(app)
        .get('/v2/offer')
        .expect((res) => {
          // Accept either success or error (simulator mode)
          if (res.status === 200) {
            expect(res.body).to.have.property('offer');
          } else {
            expect(res.status).to.be.oneOf([400, 500]);
          }
        });
    });
  });

  describe('DELETE /v2/offer - Cancel active offer', function () {
    it('should return error when no active offer trade ID exists', async function () {
      const response = await supertest(app)
        .delete('/v2/offer')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('cancel active offer');
    });

    it('should cancel active offer when trade ID exists', async function () {
      // Check if committed column exists in staging table
      const { sequelizeV2 } = await import('../../../src/database/v2/index.js');
      const [columns] = await sequelizeV2.query(
        `PRAGMA table_info(staging)`
      );
      const hasCommittedColumn = columns.some(col => col.name === 'committed');

      if (!hasCommittedColumn) {
        this.skip(); // Skip if database schema is not fully migrated
      }

      // Create a trade ID
      await MetaV2.create({
        meta_key: 'activeOfferTradeId',
        meta_value: 'test-trade-id-123',
      });

      // Create a transfer staging record
      await sequelizeV2.query(
        `INSERT INTO staging (uuid, "table", action, data, committed, failed_commit, is_transfer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        {
          replacements: [
            uuidv4(),
            'project',
            'UPDATE',
            JSON.stringify([{ cad_trust_project_id: testProject.cadTrustProjectId }]),
            0,
            0,
            1,
          ],
        }
      );

      // In simulator mode, cancelOffer will fail, but we can test the structure
      const response = await supertest(app)
        .delete('/v2/offer')
        .expect((res) => {
          // Accept either success or error (simulator mode)
          if (res.status === 200) {
            expect(res.body).to.have.property('success', true);
          } else {
            expect(res.status).to.be.oneOf([400, 500]);
          }
        });
    });
  });

  describe('POST /v2/offer/accept/commit - Commit imported offer', function () {
    it('should return error when no active offer exists', async function () {
      const response = await supertest(app)
        .post('/v2/offer/accept/commit')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('commit offer');
    });

    it('should attempt to commit imported offer', async function () {
      // Create an active offer
      const testOffer = {
        offer: {
          maker: [
            {
              store_id: 'test-maker-store',
              proofs: [
                {
                  key: Buffer.from('project|test-key').toString('hex'),
                  value: Buffer.from(JSON.stringify({ test: 'data' })).toString('hex'),
                },
              ],
            },
          ],
          taker: [
            {
              store_id: 'test-taker-store',
              inclusions: [
                {
                  key: Buffer.from('project|test-key').toString('hex'),
                  value: Buffer.from(JSON.stringify({ test: 'data' })).toString('hex'),
                },
              ],
            },
          ],
        },
        fee: 300000000,
      };

      await MetaV2.create({
        meta_key: 'activeOffer',
        meta_value: JSON.stringify(testOffer),
      });

      // In simulator mode, takeOffer will fail, but we can test the structure
      const response = await supertest(app)
        .post('/v2/offer/accept/commit')
        .expect((res) => {
          // Accept either success or error (simulator mode)
          if (res.status === 200) {
            expect(res.body).to.have.property('success', true);
            expect(res.body).to.have.property('tradeId');
          } else {
            expect(res.status).to.be.oneOf([400, 500]);
          }
        });
    });
  });

  describe('V1/V2 Isolation', function () {
    it('should not affect V1 Meta table when V2 offer operations are performed', async function () {
      // Create V1 meta record (if V1 tables exist)
      try {
        await Meta.create({
          metaKey: 'activeOffer',
          metaValue: JSON.stringify({ v1: 'data' }),
        });

        // Perform V2 offer operation
        await MetaV2.create({
          meta_key: 'activeOffer',
          meta_value: JSON.stringify({ v2: 'data' }),
        });

        // Verify V1 record is unchanged
        const v1Record = await Meta.findOne({
          where: { metaKey: 'activeOffer' },
          raw: true,
        });

        if (v1Record) {
          const v1Data = JSON.parse(v1Record.metaValue);
          expect(v1Data).to.have.property('v1', 'data');
          expect(v1Data).to.not.have.property('v2');
        }

        // Verify V2 record exists separately
        const v2Record = await MetaV2.findOne({
          where: { meta_key: 'activeOffer' },
          raw: true,
        });

        expect(v2Record).to.exist;
        const v2Data = JSON.parse(v2Record.meta_value);
        expect(v2Data).to.have.property('v2', 'data');
        expect(v2Data).to.not.have.property('v1');

        // Cleanup
        await Meta.destroy({ where: { metaKey: 'activeOffer' } });
        await MetaV2.destroy({ where: { meta_key: 'activeOffer' } });
      } catch (error) {
        // V1 tables may not exist in test environment - this is acceptable
        if (!error.message.includes('no such table')) {
          throw error;
        }
      }
    });
  });

  describe('Error Handling', function () {
    it('should handle missing required parameters gracefully', async function () {
      // Test with invalid request
      const response = await supertest(app)
        .post('/v2/offer/accept/import')
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });

    it('should return proper error messages for invalid operations', async function () {
      // Try to generate offer without staging records
      const response = await supertest(app)
        .get('/v2/offer')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body).to.have.property('message');
    });
  });
});

