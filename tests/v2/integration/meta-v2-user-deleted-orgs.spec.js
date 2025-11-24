import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import MetaV2, { USER_DELETED_ORGS } from '../../../src/models/v2/meta-v2.model.js';

/**
 * Phase 27.2: MetaV2 User Deleted Orgs Tests
 *
 * Tests for MetaV2 user deleted organizations tracking methods
 */
describe('Phase 27.2: MetaV2 User Deleted Orgs Tests', function () {
  this.timeout(10000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up MetaV2 records before each test
    await MetaV2.destroy({ where: {} });
  });

  describe('getUserDeletedOrgUids', function () {
    it('should return undefined when no deleted orgs exist', async function () {
      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.be.undefined;
    });

    it('should return array of deleted org UIDs when they exist', async function () {
      const deletedOrgs = ['org-1', 'org-2', 'org-3'];
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(deletedOrgs),
      });

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.be.an('array');
      expect(result).to.have.length(3);
      expect(result).to.include.members(deletedOrgs);
    });

    it('should parse JSON correctly from meta_value', async function () {
      const deletedOrgs = ['test-org-123'];
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(deletedOrgs),
      });

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.deep.equal(deletedOrgs);
    });
  });

  describe('addUserDeletedOrgUid', function () {
    it('should create new record when no deleted orgs exist', async function () {
      const orgUid = 'new-deleted-org';
      await MetaV2.addUserDeletedOrgUid(orgUid);

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result).to.include(orgUid);
    });

    it('should add org UID to existing list', async function () {
      const existingOrgs = ['org-1', 'org-2'];
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(existingOrgs),
      });

      await MetaV2.addUserDeletedOrgUid('org-3');

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(3);
      expect(result).to.include.members([...existingOrgs, 'org-3']);
    });

    it('should not add duplicate org UIDs', async function () {
      const existingOrgs = ['org-1'];
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(existingOrgs),
      });

      await MetaV2.addUserDeletedOrgUid('org-1'); // Try to add duplicate

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(1);
      expect(result).to.include('org-1');
    });

    it('should use snake_case field names', async function () {
      await MetaV2.addUserDeletedOrgUid('test-org');

      const metaRecord = await MetaV2.findOne({
        where: { meta_key: USER_DELETED_ORGS },
        raw: true,
      });

      expect(metaRecord).to.exist;
      expect(metaRecord.meta_key).to.equal(USER_DELETED_ORGS);
      expect(metaRecord.meta_value).to.exist;
    });
  });

  describe('removeUserDeletedOrgUid', function () {
    it('should do nothing when no deleted orgs exist', async function () {
      await MetaV2.removeUserDeletedOrgUid('some-org');
      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.be.undefined;
    });

    it('should remove org UID from list', async function () {
      const orgs = ['org-1', 'org-2', 'org-3'];
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(orgs),
      });

      await MetaV2.removeUserDeletedOrgUid('org-2');

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(2);
      expect(result).to.include('org-1');
      expect(result).to.include('org-3');
      expect(result).to.not.include('org-2');
    });

    it('should handle removing last org UID', async function () {
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(['last-org']),
      });

      await MetaV2.removeUserDeletedOrgUid('last-org');

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.be.an('array');
      expect(result).to.have.length(0);
    });

    it('should not error when removing non-existent org UID', async function () {
      const orgs = ['org-1'];
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify(orgs),
      });

      await MetaV2.removeUserDeletedOrgUid('non-existent-org');

      const result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(1);
      expect(result).to.include('org-1');
    });
  });

  describe('Integration: Add and Remove', function () {
    it('should handle adding and removing multiple orgs', async function () {
      // Add orgs
      await MetaV2.addUserDeletedOrgUid('org-1');
      await MetaV2.addUserDeletedOrgUid('org-2');
      await MetaV2.addUserDeletedOrgUid('org-3');

      let result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(3);

      // Remove one
      await MetaV2.removeUserDeletedOrgUid('org-2');

      result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(2);
      expect(result).to.include('org-1');
      expect(result).to.include('org-3');
      expect(result).to.not.include('org-2');

      // Remove another
      await MetaV2.removeUserDeletedOrgUid('org-1');

      result = await MetaV2.getUserDeletedOrgUids();
      expect(result).to.have.length(1);
      expect(result).to.include('org-3');
    });
  });
});

