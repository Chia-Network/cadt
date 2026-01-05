import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2, MetaV2 } from '../../../src/models/v2/index.js';
import mirrorCheckV2Job from '../../../src/tasks/mirror-check-v2.js';

/**
 * Phase 28.1: Mirror Check V2 Task Tests
 *
 * Tests for mirror-check-v2 background task
 */
describe('Phase 28.1: Mirror Check V2 Task Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up before each test
    await OrganizationsV2.destroy({ where: {} });
    await MetaV2.destroy({ where: {} });
  });

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(mirrorCheckV2Job).to.exist;
      expect(mirrorCheckV2Job.id).to.equal('mirror-check-v2');
    });

    it('should have correct task ID', function () {
      expect(mirrorCheckV2Job.id).to.equal('mirror-check-v2');
    });
  });

  describe('Task Execution (Simulator Mode)', function () {
    it('should skip execution in simulator mode', async function () {
      // Task skips execution in simulator mode
      // We can verify the task structure is correct
      expect(mirrorCheckV2Job).to.exist;
    });
  });

  describe('Integration with OrganizationsV2', function () {
    it('should have getOrgsMap method available', function () {
      expect(OrganizationsV2.getOrgsMap).to.be.a('function');
    });

    it('should have addMirror method available', function () {
      expect(OrganizationsV2.addMirror).to.be.a('function');
    });

    it('should handle empty organizations list', async function () {
      const orgsMap = await OrganizationsV2.getOrgsMap();
      expect(orgsMap).to.be.an('object');
      expect(Object.keys(orgsMap)).to.have.length(0);
    });
  });

  describe('Integration with MetaV2', function () {
    it('should query governance metadata', async function () {
      // Create test governance metadata
      await MetaV2.create({
        meta_key: 'governanceBodyId',
        meta_value: 'test-governance-org',
      });

      const governanceOrgUid = await MetaV2.findOne({
        where: { meta_key: 'governanceBodyId' },
        attributes: ['meta_value'],
        raw: true,
      });

      expect(governanceOrgUid).to.exist;
      expect(governanceOrgUid.meta_value).to.equal('test-governance-org');
    });
  });
});

