import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { resetV2DataTables, createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';
import { ProgramV2, ProjectV2, LocationV2 } from '../../../src/models/v2/index.js';

describe('V2 Location API - Basic CRUD Tests', function () {
  let testProgram;
  let testProject;

  beforeEach(async function () {
    // Reset all V2 data tables before each test
    await resetV2DataTables();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create test program
    testProgram = await ProgramV2.create({
      cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440001',
      programName: 'Test Program',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
      programRegistryProgramId: 'TEST-PROG-001',
      programDescription: 'Test program description',
    });

    // Create test project
    testProject = await ProjectV2.create({
      cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440002',
      orgUid: homeOrgId,
      projectRegistryName: 'TEST-REGISTRY',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });
  });

  describe('POST /v2/location (Create)', function () {
    it('should create a new location record', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationRegion: 'British Columbia',
        locationGis: '{"lat": 49.2827, "lng": -123.1207}',
        locationMapType: 'geojson',
        locationMapFileLink: 'https://example.com/map.geojson',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Location staged successfully');
      expect(response.body).to.have.property('uuid');
    });

    it('should create location with all required data', async function () {
      const locationData = {
        locationCountry: 'Canada',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body).to.have.property('uuid');
    });

    it('should reject location without required locationCountry', async function () {
      const locationData = {
        locationRegion: 'British Columbia',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('locationCountry');
    });

    it('should reject location without required cadTrustProjectId', async function () {
      const locationData = {
        locationCountry: 'Canada',
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId" is required');
    });

    it('should reject location with invalid locationMapFileLink format', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationMapFileLink: 'not-a-valid-url',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('must be a valid uri');
    });

    it('should accept location with valid locationMapFileLink format', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationMapFileLink: 'https://example.com/map.geojson',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body).to.have.property('uuid');
    });

    // Foreign key validation tests
    it('should reject location with invalid cadTrustProjectId', async function () {
      const invalidData = {
        locationCountry: 'Canada',
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept location with valid cadTrustProjectId', async function () {
      const locationData = {
        locationCountry: 'Canada',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body).to.have.property('uuid');
    });

    it('should reject location with forbidden createdAt field', async function () {
      const locationData = {
        locationCountry: 'Canada',
        cadTrustProjectId: testProject.cadTrustProjectId,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt" is not allowed');
    });

    it('should reject location with forbidden updatedAt field', async function () {
      const locationData = {
        locationCountry: 'Canada',
        cadTrustProjectId: testProject.cadTrustProjectId,
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt" is not allowed');
    });

    it('should reject location with forbidden cadTrustLocationId field', async function () {
      const locationData = {
        locationCountry: 'Canada',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustLocationId: '550e8400-e29b-41d4-a716-446655440999',
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustLocationId is auto-generated and cannot be set via API');
    });

    // Additional validation tests
    it('should reject location with locationRegion exceeding max length', async function () {
      // Test length validation on locationRegion (no picklist validation)
      const locationData = {
        locationCountry: 'Canada',
        locationRegion: 'A'.repeat(256), // Exceeds 255 character limit
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('length must be less than or equal to 255');
    });


    it('should reject location with locationGis exceeding max length', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationGis: 'A'.repeat(10001), // Exceeds 10000 character limit
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('length must be less than or equal to 10000');
    });

    it('should reject location with locationMapType exceeding max length', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationMapType: 'A'.repeat(101), // Exceeds 100 character limit
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('length must be less than or equal to 100');
    });

    it('should reject location with locationMapFileLink exceeding max length', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationMapFileLink: 'https://example.com/' + 'A'.repeat(500), // Exceeds 500 character limit
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('length must be less than or equal to 500');
    });

    it('should accept location with valid field lengths at boundaries', async function () {
      const locationData = {
        locationCountry: 'Canada',
        locationRegion: 'A'.repeat(255), // Exactly at limit
        locationGis: 'A'.repeat(10000), // Exactly at limit
        locationMapType: 'A'.repeat(100), // Exactly at limit
        locationMapFileLink: 'https://example.com/' + 'A'.repeat(500 - 20), // Just under limit
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body).to.have.property('uuid');
    });
  });

  describe('GET /v2/location (List)', function () {
    it('should return empty array when no locations exist', async function () {
      const response = await supertest(app)
        .get('/v2/location')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(0);
    });

    it('should return locations from database', async function () {
      // Create a location directly in database
      const location = await LocationV2.create({
        cadTrustLocationId: '550e8400-e29b-41d4-a716-446655440003',
        locationCountry: 'Canada',
        locationRegion: 'British Columbia',
        cadTrustProjectId: testProject.cadTrustProjectId,
      });

      const response = await supertest(app)
        .get('/v2/location')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].locationCountry).to.equal('Canada');
      expect(response.body.data[0].locationRegion).to.equal('British Columbia');
      // Note: Project association is not included by default - use columns parameter if needed
    });
  });

  describe('GET /v2/location/:id (Get One)', function () {
    it('should return 404 for non-existent location', async function () {
      const response = await supertest(app)
        .get('/v2/location/550e8400-e29b-41d4-a716-446655440999')
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal('Location not found');
    });

    it('should return location by ID', async function () {
      // Create a location directly in database
      const location = await LocationV2.create({
        cadTrustLocationId: '550e8400-e29b-41d4-a716-446655440004',
        locationCountry: 'Canada',
        locationRegion: 'British Columbia',
        cadTrustProjectId: testProject.cadTrustProjectId,
      });

      const response = await supertest(app)
        .get(`/v2/location/${location.cadTrustLocationId}`)
        .expect(200);

      expect(response.body.cadTrustLocationId).to.equal(location.cadTrustLocationId);
      expect(response.body.locationCountry).to.equal('Canada');
      expect(response.body.locationRegion).to.equal('British Columbia');
      // Note: Project association is not included by default - use columns parameter if needed
    });
  });

  describe('PUT /v2/location/:id (Update)', function () {
    it('should return 404 for non-existent location', async function () {
      const updateData = {
        locationCountry: 'United States of America',
        locationRegion: 'Updated Region',
        locationGis: '{"lat": 50.0, "lng": -120.0}',
        locationMapType: 'geojson',
        locationMapFileLink: 'https://example.com/updated-map.geojson',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .put('/v2/location/550e8400-e29b-41d4-a716-446655440999')
        .send(updateData)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal('Location not found');
    });

    it('should stage location update', async function () {
      // Create a location directly in database
      const location = await LocationV2.create({
        cadTrustLocationId: '550e8400-e29b-41d4-a716-446655440005',
        locationCountry: 'Canada',
        locationRegion: 'British Columbia',
        cadTrustProjectId: testProject.cadTrustProjectId,
      });

      const updateData = {
        locationCountry: 'United States of America',
        locationRegion: 'Updated Region',
        locationGis: '{"lat": 50.0, "lng": -120.0}',
        locationMapType: 'geojson',
        locationMapFileLink: 'https://example.com/updated-map.geojson',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .put(`/v2/location/${location.cadTrustLocationId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Location updated successfully');
    });
  });

  describe('DELETE /v2/location/:id (Delete)', function () {
    it('should return 404 for non-existent location', async function () {
      const response = await supertest(app)
        .delete('/v2/location/550e8400-e29b-41d4-a716-446655440999')
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal('Location not found');
    });

    it('should stage location deletion', async function () {
      // Create a location directly in database
      const location = await LocationV2.create({
        cadTrustLocationId: '550e8400-e29b-41d4-a716-446655440006',
        locationCountry: 'Canada',
        locationRegion: 'British Columbia',
        cadTrustProjectId: testProject.cadTrustProjectId,
      });

      const response = await supertest(app)
        .delete(`/v2/location/${location.cadTrustLocationId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Location deleted successfully');
    });
  });
});
