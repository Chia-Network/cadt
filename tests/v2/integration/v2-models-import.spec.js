import { expect } from 'chai';

describe('V2 System Models - Import Test', function () {
  this.timeout(5000);

  describe('V2 Models Import', function () {
    it('should import all V2 system models without errors', async function () {
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
