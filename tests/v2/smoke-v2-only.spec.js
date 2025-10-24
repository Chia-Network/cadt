import { expect } from 'chai';
import { prepareV2Db } from '../../src/database/v2/index.js';

describe('V2 Infrastructure - Isolated Smoke Test', function () {
  this.timeout(30000); // 30 second timeout for smoke test

  before(async function () {
    console.log('Setting up V2-only test environment...');
    await prepareV2Db();
  });

  after(async function () {
    console.log('V2-only smoke test completed');
  });

  describe('V2 Database Connection', function () {
    it('should connect to V2 database successfully', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');
      await sequelizeV2.authenticate();
      expect(sequelizeV2).to.exist;
    });

    it('should have V2 database configuration correct', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');

      expect(sequelizeV2.options.dialect).to.equal('sqlite');
      // In test mode, database path may be different, just verify it's a sqlite file
      expect(sequelizeV2.options.storage).to.match(/\.sqlite3$/);
    });
  });

  describe('V2 System Tables', function () {
    it('should have all V2 system tables created', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');

      const tables = await sequelizeV2.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        { type: sequelizeV2.QueryTypes.SELECT }
      );

      const tableNames = tables.map(t => t.name);
      const expectedTables = ['staging', 'audit', 'organizations', 'meta', 'governance', 'simulator', 'methodology', 'program', 'project', 'validation', 'verification', 'issuance', 'unit', 'location', 'estimation', 'rating', 'co_benefit', 'project_methodolgy', 'stakeholder', 'stakeholder_projects', 'label', 'unit_label', 'aef_t1_submission', 'aef_t5_authorized_entities', 'aef_t2_authorizations', 'aef_t3_actions', 'aef_t4_holdings'];

      for (const expectedTable of expectedTables) {
        expect(tableNames).to.include(expectedTable);
      }
    });

    it('should have correct V2 staging table schema', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');

      const columns = await sequelizeV2.query(
        "PRAGMA table_info(staging)",
        { type: sequelizeV2.QueryTypes.SELECT }
      );

      const columnNames = columns.map(c => c.name);

      // Verify snake_case columns
      expect(columnNames).to.include('id');
      expect(columnNames).to.include('uuid');
      expect(columnNames).to.include('table');
      expect(columnNames).to.include('action');
      expect(columnNames).to.include('data');
      expect(columnNames).to.include('commited');
      expect(columnNames).to.include('failed_commit');
      expect(columnNames).to.include('is_transfer');
      expect(columnNames).to.include('created_at');
      expect(columnNames).to.include('updated_at');
    });

    it('should have correct V2 organizations table schema', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');

      const columns = await sequelizeV2.query(
        "PRAGMA table_info(organizations)",
        { type: sequelizeV2.QueryTypes.SELECT }
      );

      const columnNames = columns.map(c => c.name);

      // Verify snake_case columns
      expect(columnNames).to.include('id');
      expect(columnNames).to.include('org_uid');
      expect(columnNames).to.include('name');
      expect(columnNames).to.include('subscribed');
      expect(columnNames).to.include('synced');
      expect(columnNames).to.include('is_home');
      expect(columnNames).to.include('created_at');
      expect(columnNames).to.include('updated_at');
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

    it('should load V2 methodology, program, project, validation, verification, issuance, unit, location, estimation, rating, co-benefit, project-methodology, stakeholder, stakeholder-projects, label, unit-label, aef-t1-submission, aef-t5-authorized-entities, aef-t2-authorizations, aef-t3-actions, and aef-t4-holdings models', async function () {
      const V2Models = await import('../../src/models/v2/index.js');

      expect(V2Models.MethodologyV2).to.exist;
      expect(V2Models.MethodologyV2Mirror).to.exist;
      expect(V2Models.ProgramV2).to.exist;
      expect(V2Models.ProgramV2Mirror).to.exist;
      expect(V2Models.ProjectV2).to.exist;
      expect(V2Models.ProjectV2Mirror).to.exist;
      expect(V2Models.ValidationV2).to.exist;
      expect(V2Models.ValidationV2Mirror).to.exist;
      expect(V2Models.VerificationV2).to.exist;
      expect(V2Models.VerificationV2Mirror).to.exist;
      expect(V2Models.IssuanceV2).to.exist;
      expect(V2Models.IssuanceV2Mirror).to.exist;
      expect(V2Models.UnitV2).to.exist;
      expect(V2Models.UnitV2Mirror).to.exist;
      expect(V2Models.LocationV2).to.exist;
      expect(V2Models.LocationV2Mirror).to.exist;
      expect(V2Models.EstimationV2).to.exist;
      expect(V2Models.EstimationV2Mirror).to.exist;
      expect(V2Models.RatingV2).to.exist;
      expect(V2Models.RatingV2Mirror).to.exist;
      expect(V2Models.CoBenefitV2).to.exist;
      expect(V2Models.CoBenefitV2Mirror).to.exist;
      expect(V2Models.ProjectMethodologyV2).to.exist;
      expect(V2Models.ProjectMethodologyV2Mirror).to.exist;
      expect(V2Models.StakeholderV2).to.exist;
      expect(V2Models.StakeholderV2Mirror).to.exist;
      expect(V2Models.StakeholderProjectV2).to.exist;
      expect(V2Models.StakeholderProjectV2Mirror).to.exist;
      expect(V2Models.LabelV2).to.exist;
      expect(V2Models.LabelV2Mirror).to.exist;
      expect(V2Models.UnitLabelV2).to.exist;
      expect(V2Models.UnitLabelV2Mirror).to.exist;
      expect(V2Models.AefT1SubmissionV2).to.exist;
      expect(V2Models.AefT1SubmissionV2Mirror).to.exist;
      expect(V2Models.AefT5AuthorizedEntitiesV2).to.exist;
      expect(V2Models.AefT5AuthorizedEntitiesV2Mirror).to.exist;
      expect(V2Models.AefT2AuthorizationsV2).to.exist;
      expect(V2Models.AefT2AuthorizationsV2Mirror).to.exist;
      expect(V2Models.AefT3ActionsV2).to.exist;
      expect(V2Models.AefT3ActionsV2Mirror).to.exist;
      expect(V2Models.AefT4HoldingsV2).to.exist;
      expect(V2Models.AefT4HoldingsV2Mirror).to.exist;
    });
  });

  describe('V2 Basic CRUD Operations', function () {
    it('should create and read V2 staging records', async function () {
      const { StagingV2 } = await import('../../src/models/v2/index.js');

      const testData = {
        uuid: 'test-uuid-smoke',
        table: 'test_table',
        action: 'INSERT',
        data: JSON.stringify([{ test: 'data' }]),
        commited: false,
        failed_commit: false,
        is_transfer: false,
      };

      const stagingRecord = await StagingV2.create(testData);

      expect(stagingRecord.table).to.equal('test_table');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.commited).to.be.false;
      expect(stagingRecord.failed_commit).to.be.false;
      expect(stagingRecord.is_transfer).to.be.false;

      // Clean up
      await StagingV2.destroy({ where: { uuid: 'test-uuid-smoke' } });
    });

    it('should create and read V2 organization records', async function () {
      const { OrganizationsV2 } = await import('../../src/models/v2/index.js');

      const orgData = {
        org_uid: 'test-org-smoke-v2',
        name: 'Test Organization Smoke V2',
        subscribed: true,
        synced: true,
        is_home: false,
      };

      const orgRecord = await OrganizationsV2.create(orgData);

      expect(orgRecord.org_uid).to.equal('test-org-smoke-v2');
      expect(orgRecord.name).to.equal('Test Organization Smoke V2');
      expect(orgRecord.subscribed).to.be.true;
      expect(orgRecord.synced).to.be.true;
      expect(orgRecord.is_home).to.be.false;

      // Clean up
      await OrganizationsV2.destroy({ where: { org_uid: 'test-org-smoke-v2' } });
    });

    it('should create and read V2 meta records', async function () {
      const { MetaV2 } = await import('../../src/models/v2/index.js');

      const metaRecord = await MetaV2.create({
        meta_key: 'test_meta_key_v2',
        meta_value: 'test_meta_value_v2',
      });

      expect(metaRecord.meta_key).to.equal('test_meta_key_v2');
      expect(metaRecord.meta_value).to.equal('test_meta_value_v2');
      expect(metaRecord).to.have.property('created_at');
      expect(metaRecord).to.have.property('updated_at');

      // Clean up
      await MetaV2.destroy({ where: { meta_key: 'test_meta_key_v2' } });
    });

    it('should create and read V2 governance records', async function () {
      const { GovernanceV2 } = await import('../../src/models/v2/index.js');

      const governanceRecord = await GovernanceV2.create({
        meta_key: 'test_gov_key_v2',
        meta_value: 'test_gov_value_v2',
        confirmed: true,
      });

      expect(governanceRecord.meta_key).to.equal('test_gov_key_v2');
      expect(governanceRecord.meta_value).to.equal('test_gov_value_v2');
      expect(governanceRecord.confirmed).to.be.true;
      expect(governanceRecord).to.have.property('created_at');
      expect(governanceRecord).to.have.property('updated_at');

      // Clean up
      await GovernanceV2.destroy({ where: { meta_key: 'test_gov_key_v2' } });
    });

    it('should create and read V2 simulator records', async function () {
      const { SimulatorV2 } = await import('../../src/models/v2/index.js');

      const simulatorRecord = await SimulatorV2.create({
        key: 'test_sim_key_v2',
        value: 'test_sim_value_v2',
      });

      expect(simulatorRecord.key).to.equal('test_sim_key_v2');
      expect(simulatorRecord.value).to.equal('test_sim_value_v2');
      expect(simulatorRecord).to.have.property('created_at');
      expect(simulatorRecord).to.have.property('updated_at');

      // Clean up
      await SimulatorV2.destroy({ where: { key: 'test_sim_key_v2' } });
    });
  });

  describe('V2 Snake Case Validation', function () {
    it('should use snake_case for all V2 database columns', async function () {
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');

      const tables = ['staging', 'organizations', 'meta', 'governance', 'simulator'];

      for (const tableName of tables) {
        const columns = await sequelizeV2.query(
          `PRAGMA table_info(${tableName})`,
          { type: sequelizeV2.QueryTypes.SELECT }
        );

        const columnNames = columns.map(c => c.name);

        // All columns should be snake_case
        columnNames.forEach(column => {
          expect(column).to.match(/^[a-z][a-z0-9_]*$/);
        });
      }
    });
  });

  describe('V2 Isolation', function () {
    it('should maintain V1/V2 isolation', async function () {
      // Verify V2 database is separate from V1
      const { sequelizeV2 } = await import('../../src/database/v2/index.js');
      const { sequelize } = await import('../../src/database/index.js');

      expect(sequelizeV2).to.not.equal(sequelize);

      // Verify V2 database path is different (in test mode, both may be test files)
      expect(sequelizeV2.options.storage).to.not.equal(sequelize.options.storage);
    });
  });
});
