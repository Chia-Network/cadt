import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';

describe('V2 System Models - Loading Test', function () {
  this.timeout(10000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  describe('V2 Models Loading', function () {
    it('should load all V2 system models without errors', async function () {
      const V2Models = await import('../../../src/models/v2/index.js');

      expect(V2Models.StagingV2).to.exist;
      expect(V2Models.OrganizationsV2).to.exist;
      expect(V2Models.MetaV2).to.exist;
      expect(V2Models.GovernanceV2).to.exist;
      expect(V2Models.AuditV2).to.exist;
      expect(V2Models.AuditV2Mirror).to.exist;
      expect(V2Models.OrganizationsV2Mirror).to.exist;
      expect(V2Models.SimulatorV2).to.exist;
    });

    it('should create V2 model instances successfully', async function () {
      const { StagingV2, OrganizationsV2, MetaV2, GovernanceV2, AuditV2, SimulatorV2 } = await import('../../../src/models/v2/index.js');

      // Test that models can be instantiated
      expect(StagingV2).to.be.a('function');
      expect(OrganizationsV2).to.be.a('function');
      expect(MetaV2).to.be.a('function');
      expect(GovernanceV2).to.be.a('function');
      expect(AuditV2).to.be.a('function');
      expect(SimulatorV2).to.be.a('function');
    });

    it('should have correct V2 model configurations', async function () {
      const { StagingV2, OrganizationsV2, MetaV2 } = await import('../../../src/models/v2/index.js');

      // Test model configurations
      expect(StagingV2.options.tableName).to.equal('staging');
      expect(StagingV2.name).to.equal('StagingV2');
      expect(StagingV2.options.timestamps).to.be.true;
      expect(StagingV2.options.createdAt).to.equal('created_at');
      expect(StagingV2.options.updatedAt).to.equal('updated_at');
      expect(StagingV2.options.underscored).to.be.true;

      expect(OrganizationsV2.options.tableName).to.equal('organizations');
      expect(OrganizationsV2.name).to.equal('OrganizationsV2');

      expect(MetaV2.options.tableName).to.equal('meta');
      expect(MetaV2.name).to.equal('MetaV2');
    });

    it('should have snake_case attributes in model types', async function () {
      const { StagingV2 } = await import('../../../src/models/v2/index.js');

      // Check that model has snake_case attributes
      const attributes = Object.keys(StagingV2.rawAttributes);

      expect(attributes).to.include('failed_commit');
      expect(attributes).to.include('is_transfer');
      expect(attributes).to.include('created_at');
      expect(attributes).to.include('updated_at');

      // Should NOT have camelCase attributes
      expect(attributes).to.not.include('failedCommit');
      expect(attributes).to.not.include('isTransfer');
      expect(attributes).to.not.include('createdAt');
      expect(attributes).to.not.include('updatedAt');
    });

    it('should have correct primary key configurations', async function () {
      const { StagingV2, OrganizationsV2, MetaV2 } = await import('../../../src/models/v2/index.js');

      // System tables should have INTEGER AUTO_INCREMENT primary keys
      expect(StagingV2.rawAttributes.id.type.constructor.name).to.equal('INTEGER');
      expect(StagingV2.rawAttributes.id.primaryKey).to.be.true;
      expect(StagingV2.rawAttributes.id.autoIncrement).to.be.true;

      expect(OrganizationsV2.rawAttributes.id.type.constructor.name).to.equal('INTEGER');
      expect(OrganizationsV2.rawAttributes.id.primaryKey).to.be.true;
      expect(OrganizationsV2.rawAttributes.id.autoIncrement).to.be.true;

      expect(MetaV2.rawAttributes.id.type.constructor.name).to.equal('INTEGER');
      expect(MetaV2.rawAttributes.id.primaryKey).to.be.true;
      expect(MetaV2.rawAttributes.id.autoIncrement).to.be.true;
    });
  });
});
