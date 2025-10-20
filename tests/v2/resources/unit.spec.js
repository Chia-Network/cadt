import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import newUnit from '../test-data/new-unit.js';
import newIssuance from '../test-data/new-issuance.js';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  cleanupV2TestData,
  getV2TestTimeout,
} from '../test-fixtures';

describe('V2 Unit Resource CRUD', function () {
  let homeOrgUid;
  let issuanceId;

  before(async function () {
    homeOrgUid = await createV2TestHomeOrg();

    // Create an issuance first for foreign key reference
    const issuanceResponse = await supertest(app)
      .post('/v2/issuance')
      .send(newIssuance);
    issuanceId = issuanceResponse.body.uuid;
  });

  beforeEach(async function () {
    await resetV2StagingTable();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('POST - Create Unit', function () {
    it('creates a new unit successfully', async function () {
      const unitData = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData);

      validateV2SuccessResponse(response, 'Unit staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body.uuid).to.be.a('string');
    }).timeout(getV2TestTimeout());

    it('rejects unit creation with missing required fields', async function () {
      const invalidUnit = {
        unitSerialId: 'V2-UNIT-001',
        // Missing unitStartBlock, unitEndBlock, unitVintageYear, cadTrustIssuanceId
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidUnit);

      validateV2ErrorResponse(response, 'Error creating new unit');
    }).timeout(getV2TestTimeout());

    it('rejects unit creation with timestamp fields', async function () {
      const unitWithTimestamps = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitWithTimestamps);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('validates picklist fields', async function () {
      const unitWithInvalidPicklist = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        unitType: 'Invalid Type',
        unitStatus: 'Invalid Status',
        unitMetric: 'Invalid Metric',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitWithInvalidPicklist);

      validateV2ErrorResponse(response, 'does not include a valid option');
    }).timeout(getV2TestTimeout());

    it('creates unit with all optional fields', async function () {
      const fullUnit = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        unitStatusReason: 'Freshly issued unit',
        unitStatusDate: '2025-01-01T00:00:00.000Z',
        unitRetirementDetail: 'Retired for climate action',
        unitRetirementBeneficiary: 'V2 Climate Organization',
        unitRetirementBeneficiaryId: 'V2-ORG-001',
        unitLink: 'https://v2-example.com/unit/001',
        unitCurrentOwner: 'V2 Test Organization',
        unitItmosReferenceId: 'V2-ITMO-001',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(fullUnit);

      validateV2SuccessResponse(response, 'Unit staged successfully');
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find All Units', function () {
    beforeEach(async function () {
      // Create test units
      await supertest(app).post('/v2/unit').send({
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
      });

      await supertest(app).post('/v2/unit').send({
        ...newUnit,
        unitSerialId: 'V2-UNIT-002',
        cadTrustIssuanceId: issuanceId,
      });
    });

    it('retrieves all units successfully', async function () {
      const response = await supertest(app).get('/v2/unit');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    }).timeout(getV2TestTimeout());

    it('retrieves units with pagination', async function () {
      const response = await supertest(app)
        .get('/v2/unit')
        .query({ page: 1, limit: 1 });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.lessThanOrEqual(1);
    }).timeout(getV2TestTimeout());

    it('filters units by search criteria', async function () {
      const response = await supertest(app)
        .get('/v2/unit')
        .query({ search: 'V2-UNIT-002' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      const unit002 = response.body.find(u => u.unitSerialId === 'V2-UNIT-002');
      expect(unit002).to.be.ok;
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find Unit by ID', function () {
    let unitId;

    beforeEach(async function () {
      const response = await supertest(app).post('/v2/unit').send({
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
      });
      unitId = response.body.uuid;
    });

    it('retrieves a specific unit by ID', async function () {
      const response = await supertest(app).get(`/v2/unit/${unitId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('unitSerialId', newUnit.unitSerialId);
      expect(response.body).to.have.property('unitStartBlock', newUnit.unitStartBlock);
      expect(response.body).to.have.property('unitEndBlock', newUnit.unitEndBlock);
    }).timeout(getV2TestTimeout());

    it('returns 404 for non-existent unit ID', async function () {
      const response = await supertest(app).get('/v2/unit/999999');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Unit not found');
      expect(response.body).to.have.property('success', false);
    }).timeout(getV2TestTimeout());
  });

  describe('PUT - Update Unit', function () {
    let unitId;

    beforeEach(async function () {
      const response = await supertest(app).post('/v2/unit').send({
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
      });
      unitId = response.body.uuid;
    });

    it('updates a unit successfully', async function () {
      const updateData = {
        unitStatus: 'Retired',
        unitStatusReason: 'Retired for climate action',
        unitRetirementDetail: 'Retired for climate action',
      };

      const response = await supertest(app)
        .put(`/v2/unit/${unitId}`)
        .send(updateData);

      validateV2SuccessResponse(response, 'Unit update staged successfully');
    }).timeout(getV2TestTimeout());

    it('rejects update with timestamp fields', async function () {
      const updateData = {
        unitStatus: 'Retired',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .put(`/v2/unit/${unitId}`)
        .send(updateData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('validates picklist fields in updates', async function () {
      const updateData = {
        unitType: 'Invalid Type',
      };

      const response = await supertest(app)
        .put(`/v2/unit/${unitId}`)
        .send(updateData);

      validateV2ErrorResponse(response, 'does not include a valid option');
    }).timeout(getV2TestTimeout());

    it('returns 404 for update of non-existent unit', async function () {
      const updateData = { unitStatus: 'Retired' };

      const response = await supertest(app)
        .put('/v2/unit/999999')
        .send(updateData);

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Unit not found');
    }).timeout(getV2TestTimeout());
  });

  describe('DELETE - Delete Unit', function () {
    let unitId;

    beforeEach(async function () {
      const response = await supertest(app).post('/v2/unit').send({
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
      });
      unitId = response.body.uuid;
    });

    it('deletes a unit successfully', async function () {
      const response = await supertest(app).delete(`/v2/unit/${unitId}`);

      validateV2SuccessResponse(response, 'Unit delete staged successfully');
    }).timeout(getV2TestTimeout());

    it('returns 404 for deletion of non-existent unit', async function () {
      const response = await supertest(app).delete('/v2/unit/999999');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Unit not found');
    }).timeout(getV2TestTimeout());
  });

  describe('Validation Tests', function () {
    it('validates unit serial ID is required', async function () {
      const invalidUnit = {
        unitStartBlock: '1000000',
        unitEndBlock: '1000100',
        unitVintageYear: 2025,
        cadTrustIssuanceId: issuanceId,
        // Missing unitSerialId
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidUnit);

      validateV2ErrorResponse(response, 'unitSerialId is required');
    }).timeout(getV2TestTimeout());

    it('validates unit start block is required', async function () {
      const invalidUnit = {
        unitSerialId: 'V2-UNIT-001',
        unitEndBlock: '1000100',
        unitVintageYear: 2025,
        cadTrustIssuanceId: issuanceId,
        // Missing unitStartBlock
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidUnit);

      validateV2ErrorResponse(response, 'unitStartBlock is required');
    }).timeout(getV2TestTimeout());

    it('validates unit end block is required', async function () {
      const invalidUnit = {
        unitSerialId: 'V2-UNIT-001',
        unitStartBlock: '1000000',
        unitVintageYear: 2025,
        cadTrustIssuanceId: issuanceId,
        // Missing unitEndBlock
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidUnit);

      validateV2ErrorResponse(response, 'unitEndBlock is required');
    }).timeout(getV2TestTimeout());

    it('validates unit vintage year is required', async function () {
      const invalidUnit = {
        unitSerialId: 'V2-UNIT-001',
        unitStartBlock: '1000000',
        unitEndBlock: '1000100',
        cadTrustIssuanceId: issuanceId,
        // Missing unitVintageYear
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidUnit);

      validateV2ErrorResponse(response, 'unitVintageYear is required');
    }).timeout(getV2TestTimeout());

    it('validates unit type picklist', async function () {
      const validTypes = ['Reduction', 'Removal', 'Avoidance'];

      for (const type of validTypes) {
        const unit = {
          ...newUnit,
          cadTrustIssuanceId: issuanceId,
          unitType: type,
        };

        const response = await supertest(app)
          .post('/v2/unit')
          .send(unit);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());

    it('validates unit status picklist', async function () {
      const validStatuses = ['Available', 'Retired', 'Exported', 'Cancelled'];

      for (const status of validStatuses) {
        const unit = {
          ...newUnit,
          cadTrustIssuanceId: issuanceId,
          unitStatus: status,
        };

        const response = await supertest(app)
          .post('/v2/unit')
          .send(unit);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());

    it('validates unit metric picklist', async function () {
      const validMetrics = ['tCO2e', 'tCO2', 'tCH4', 'tN2O'];

      for (const metric of validMetrics) {
        const unit = {
          ...newUnit,
          cadTrustIssuanceId: issuanceId,
          unitMetric: metric,
        };

        const response = await supertest(app)
          .post('/v2/unit')
          .send(unit);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());
  });

  describe('Edge Cases', function () {
    it('handles very large unit counts', async function () {
      const largeCountUnit = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        unitCount: 999999999.99, // Very large count
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(largeCountUnit);

      validateV2SuccessResponse(response, 'Unit staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles special characters in unit data', async function () {
      const specialCharUnit = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        unitSerialId: 'V2-UNIT-特殊字符-001',
        unitStatusReason: 'Reason with émojis 🚀 and unicode 中文',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(specialCharUnit);

      validateV2SuccessResponse(response, 'Unit staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles future vintage years', async function () {
      const futureUnit = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        unitVintageYear: 2030, // Future year
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(futureUnit);

      validateV2SuccessResponse(response, 'Unit staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles negative unit counts', async function () {
      const negativeCountUnit = {
        ...newUnit,
        cadTrustIssuanceId: issuanceId,
        unitCount: -100.5, // Negative count
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(negativeCountUnit);

      validateV2SuccessResponse(response, 'Unit staged successfully');
    }).timeout(getV2TestTimeout());
  });

  describe('Performance Tests', function () {
    it('handles large number of units efficiently', async function () {
      const startTime = Date.now();

      // Create 100 units
      const promises = Array.from({ length: 100 }, (_, i) =>
        supertest(app).post('/v2/unit').send({
          ...newUnit,
          unitSerialId: `V2-UNIT-${i.toString().padStart(3, '0')}`,
          cadTrustIssuanceId: issuanceId,
        })
      );

      await Promise.all(promises);

      const response = await supertest(app).get('/v2/unit');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(response.status).to.equal(200);
      expect(response.body.length).to.be.greaterThanOrEqual(100);
      expect(executionTime).to.be.lessThan(20000); // Should complete within 20 seconds
    }).timeout(getV2TestTimeout() * 4);
  });
});
