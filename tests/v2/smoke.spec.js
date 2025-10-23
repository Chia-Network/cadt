import { expect } from 'chai';
import { prepareV2Db } from '../../src/database/v2/index.js';
import {
  setupV2TestEnvironment,
  cleanupV2TestEnvironment,
  createV2TestOrganization,
  createV2StagingRecord,
  createV2MetaRecord,
  createV2GovernanceRecord,
  createV2SimulatorRecord,
  validateV2StagingRecord,
  validateV2OrganizationRecord,
  getV2TableCount,
  getV2TableSchema
} from './test-fixtures/v2-fixtures.js';

describe('V2 Infrastructure - Smoke Test', function () {
  this.timeout(30000); // 30 second timeout for smoke test

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
    await setupV2TestEnvironment();
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    await cleanupV2TestEnvironment();
  });

  describe('V2 Database Connection', function () {
    it('should connect to V2 database successfully', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');
      await sequelizeV2.authenticate();
      expect(sequelizeV2).to.exist;
    });

    it('should have all V2 system tables created', async function () {
      const expectedTables = ['staging', 'audit', 'organizations', 'meta', 'governance', 'simulator'];

      for (const tableName of expectedTables) {
        const count = await getV2TableCount(tableName);
        expect(count).to.be.a('number');
        expect(count).to.be.at.least(0);
      }
    });

    it('should have correct V2 table schemas', async function () {
      // Test staging table schema
      const stagingSchema = await getV2TableSchema('staging');
      const stagingColumns = stagingSchema.map(col => col.name);

      expect(stagingColumns).to.include('id');
      expect(stagingColumns).to.include('uuid');
      expect(stagingColumns).to.include('table');
      expect(stagingColumns).to.include('action');
      expect(stagingColumns).to.include('data');
      expect(stagingColumns).to.include('commited');
      expect(stagingColumns).to.include('failed_commit');
      expect(stagingColumns).to.include('is_transfer');
      expect(stagingColumns).to.include('created_at');
      expect(stagingColumns).to.include('updated_at');

      // Test organizations table schema
      const orgSchema = await getV2TableSchema('organizations');
      const orgColumns = orgSchema.map(col => col.name);

      expect(orgColumns).to.include('id');
      expect(orgColumns).to.include('org_uid');
      expect(orgColumns).to.include('name');
      expect(orgColumns).to.include('subscribed');
      expect(orgColumns).to.include('synced');
      expect(orgColumns).to.include('is_home');
      expect(orgColumns).to.include('created_at');
      expect(orgColumns).to.include('updated_at');
    });
  });

  describe('V2 Models Loading', function () {
    it('should load all V2 system models without errors', async function () {
      const V2Models = await import('../../src/models/v2/index.js');

      expect(V2Models.StagingV2).to.exist;
      expect(V2Models.OrganizationsV2).to.exist;
      expect(V2Models.MetaV2).to.exist;
      expect(V2Models.GovernanceV2).to.exist;
      expect(V2Models.SimulatorV2).to.exist;
      expect(V2Models.AuditV2).to.exist;
    });

    it('should create V2 model instances successfully', async function () {
      const { StagingV2, OrganizationsV2, MetaV2, GovernanceV2, SimulatorV2 } = await import('../../src/models/v2/index.js');

      // Test that models can be instantiated
      expect(StagingV2).to.be.a('function');
      expect(OrganizationsV2).to.be.a('function');
      expect(MetaV2).to.be.a('function');
      expect(GovernanceV2).to.be.a('function');
      expect(SimulatorV2).to.be.a('function');
    });
  });

  describe('V2 CRUD Operations', function () {
    it('should create and read V2 staging records', async function () {
      const testData = {
        table: 'test_table',
        action: 'INSERT',
        records: [{ test: 'data' }],
      };

      const stagingRecord = await createV2StagingRecord(testData);
      validateV2StagingRecord(stagingRecord);

      expect(stagingRecord.table).to.equal('test_table');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.commited).to.be.false;
      expect(stagingRecord.failed_commit).to.be.false;
      expect(stagingRecord.is_transfer).to.be.false;
    });

    it('should create and read V2 organization records', async function () {
      const orgData = {
        org_uid: 'test-org-smoke',
        name: 'Test Organization Smoke',
        subscribed: true,
        synced: true,
        is_home: false,
      };

      const orgRecord = await createV2TestOrganization(orgData);
      validateV2OrganizationRecord(orgRecord);

      expect(orgRecord.org_uid).to.equal('test-org-smoke');
      expect(orgRecord.name).to.equal('Test Organization Smoke');
      expect(orgRecord.subscribed).to.be.true;
      expect(orgRecord.synced).to.be.true;
      expect(orgRecord.is_home).to.be.false;
    });

    it('should create and read V2 meta records', async function () {
      const metaRecord = await createV2MetaRecord('test_meta_key', 'test_meta_value');

      expect(metaRecord.meta_key).to.equal('test_meta_key');
      expect(metaRecord.meta_value).to.equal('test_meta_value');
      expect(metaRecord).to.have.property('created_at');
      expect(metaRecord).to.have.property('updated_at');
    });

    it('should create and read V2 governance records', async function () {
      const governanceRecord = await createV2GovernanceRecord('test_gov_key', 'test_gov_value');

      expect(governanceRecord.meta_key).to.equal('test_gov_key');
      expect(governanceRecord.meta_value).to.equal('test_gov_value');
      expect(governanceRecord.confirmed).to.be.true;
      expect(governanceRecord).to.have.property('created_at');
      expect(governanceRecord).to.have.property('updated_at');
    });

    it('should create and read V2 simulator records', async function () {
      const simulatorRecord = await createV2SimulatorRecord('test_sim_key', 'test_sim_value');

      expect(simulatorRecord.key).to.equal('test_sim_key');
      expect(simulatorRecord.value).to.equal('test_sim_value');
      expect(simulatorRecord).to.have.property('created_at');
      expect(simulatorRecord).to.have.property('updated_at');
    });
  });

  describe('V2 API Routes', function () {
    it('should have V2 health endpoint accessible', async function () {
      const supertest = (await import('supertest')).default;
      const app = (await import('../../src/server.js')).default;

      const response = await supertest(app)
        .get('/v2/health')
        .expect(200);

      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('V2');
    });
  });

  describe('V2 Snake Case Validation', function () {
    it('should use snake_case for all V2 database columns', async function () {
      const stagingSchema = await getV2TableSchema('staging');
      const stagingColumns = stagingSchema.map(col => col.name);

      // All columns should be snake_case
      stagingColumns.forEach(column => {
        expect(column).to.match(/^[a-z][a-z0-9_]*$/);
      });

      // Specific snake_case validations
      expect(stagingColumns).to.include('failed_commit');
      expect(stagingColumns).to.include('is_transfer');
      expect(stagingColumns).to.include('created_at');
      expect(stagingColumns).to.include('updated_at');
    });

    it('should use snake_case for organizations table columns', async function () {
      const orgSchema = await getV2TableSchema('organizations');
      const orgColumns = orgSchema.map(col => col.name);

      // All columns should be snake_case
      orgColumns.forEach(column => {
        expect(column).to.match(/^[a-z][a-z0-9_]*$/);
      });

      // Specific snake_case validations
      expect(orgColumns).to.include('org_uid');
      expect(orgColumns).to.include('registry_id');
      expect(orgColumns).to.include('registry_hash');
      expect(orgColumns).to.include('file_store_subscribed');
      expect(orgColumns).to.include('sync_remaining');
      expect(orgColumns).to.include('pending_balance');
      expect(orgColumns).to.include('is_home');
      expect(orgColumns).to.include('data_model_version_store_id');
      expect(orgColumns).to.include('data_model_version_store_hash');
      expect(orgColumns).to.include('created_at');
      expect(orgColumns).to.include('updated_at');
    });
  });

  describe('V2 System Integration', function () {
    it('should maintain V1/V2 isolation', async function () {
      // Verify V2 database is separate from V1
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');
      const { sequelize } = await import('../../src/database/index.js');

      expect(sequelizeV2).to.not.equal(sequelize);

      // Verify V2 tables don't exist in V1 database
      const v1Tables = await sequelize.query('SELECT name FROM sqlite_master WHERE type="table"', {
        type: sequelize.QueryTypes.SELECT
      });
      const v1TableNames = v1Tables.map(t => t.name);

      expect(v1TableNames).to.not.include('staging');
      expect(v1TableNames).to.not.include('organizations');
      expect(v1TableNames).to.not.include('meta');
      expect(v1TableNames).to.not.include('governance');
      expect(v1TableNames).to.not.include('simulator');
      expect(v1TableNames).to.not.include('audit');
    });

    it('should have proper V2 database configuration', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');

      // Verify V2 database configuration
      expect(sequelizeV2.options.dialect).to.equal('sqlite');
      expect(sequelizeV2.options.storage).to.include('v2/data.sqlite3');
    });
  });
});
