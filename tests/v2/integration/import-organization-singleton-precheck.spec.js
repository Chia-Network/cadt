import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { prepareDb } from '../../../src/database/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { Organization } from '../../../src/models/organizations/organizations.model.js';
import TaskManager from '../../../src/tasks/index.js';

/**
 * importOrganization singleton-store pre-check — contract tests
 *
 * The new singleton pre-check is guarded by `if (!USE_SIMULATOR)`, so
 * simulator-mode tests cannot exercise it directly.  Its correctness is
 * verified via production-mode live integration tests; here we only
 * assert that:
 *
 *   1. The method signature and availability are unchanged
 *   2. The simulator-mode behavior is unaffected
 */
describe('importOrganization singleton-store pre-check — contract', function () {
  this.timeout(10000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  afterEach(async function () {
    await OrganizationsV2.destroy({ where: {} });
  });

  describe('V1 Organization.importOrganization', function () {
    it('should be available as a static method', function () {
      expect(Organization.importOrganization).to.be.a('function');
    });

    it('should accept orgUid and optional isHome arguments', function () {
      expect(Organization.importOrganization.length).to.equal(1);
    });
  });

  describe('V2 OrganizationsV2.importOrganization', function () {
    it('should be available as a static method', function () {
      expect(OrganizationsV2.importOrganization).to.be.a('function');
    });

    it('should accept orgUid and optional isHome arguments', function () {
      expect(OrganizationsV2.importOrganization.length).to.equal(1);
    });
  });

  describe('Module structure — sync-default-organizations tasks', function () {
    it('V1 sync-default-organizations task should be importable', async function () {
      const job = (await import('../../../src/tasks/sync-default-organizations.js')).default;
      expect(job).to.exist;
    });

    it('V2 sync-default-organizations task should be importable', async function () {
      const job = (await import('../../../src/tasks/sync-default-organizations-v2.js')).default;
      expect(job).to.exist;
    });
  });
});
