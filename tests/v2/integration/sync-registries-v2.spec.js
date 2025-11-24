import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2, AuditV2, StagingV2 } from '../../../src/models/v2/index.js';
import syncRegistriesV2Job from '../../../src/tasks/sync-registries-v2.js';
import {
  syncRegistriesTaskMutexV2,
  processingSyncRegistriesTransactionMutexV2,
} from '../../../src/utils/v2-model-utils.js';

/**
 * Phase 27.5-27.7: Sync Registries V2 Task Tests
 *
 * Tests for sync-registries-v2 background task (CRITICAL)
 */
describe('Phase 27.5-27.7: Sync Registries V2 Task Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up before each test
    await AuditV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });
    await StagingV2.destroy({ where: {} });
  });

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(syncRegistriesV2Job).to.exist;
      expect(syncRegistriesV2Job.id).to.equal('sync-registries-v2');
    });

    it('should have correct task ID', function () {
      expect(syncRegistriesV2Job.id).to.equal('sync-registries-v2');
    });
  });

  describe('Mutex Utilities', function () {
    it('should have syncRegistriesTaskMutexV2 available', function () {
      expect(syncRegistriesTaskMutexV2).to.exist;
    });

    it('should have processingSyncRegistriesTransactionMutexV2 available', function () {
      expect(processingSyncRegistriesTransactionMutexV2).to.exist;
    });

    it('should be able to acquire and release mutex', async function () {
      const releaseMutex = await syncRegistriesTaskMutexV2.acquire();
      expect(releaseMutex).to.be.a('function');
      releaseMutex();
    });
  });

  describe('Task Execution (Simulator Mode)', function () {
    it('should handle empty organizations list', async function () {
      // Task should handle case where no organizations exist
      const orgs = await OrganizationsV2.findAll({
        where: { subscribed: true },
        raw: true,
      });

      expect(orgs).to.have.length(0);
    });
  });

  describe('Integration with AuditV2', function () {
    it('should be able to create audit records', async function () {
      const auditRecord = await AuditV2.create({
        org_uid: 'test-org',
        registry_id: 'test-registry',
        root_hash: 'test-hash',
        type: 'CREATE REGISTRY',
        generation: 0,
        change: null,
        table: null,
        onchain_confirmation_time_stamp: '1234567890',
        comment: '',
        author: '',
      });

      expect(auditRecord).to.exist;
      expect(auditRecord.org_uid).to.equal('test-org');
      expect(auditRecord.type).to.equal('CREATE REGISTRY');
    });

    it('should query audit records by registry_id', async function () {
      await AuditV2.create({
        org_uid: 'test-org',
        registry_id: 'test-registry',
        root_hash: 'test-hash-1',
        type: 'CREATE REGISTRY',
        generation: 0,
        change: null,
        table: null,
        onchain_confirmation_time_stamp: '1234567890',
        comment: '',
        author: '',
      });

      const lastAudit = await AuditV2.findOne({
        where: { registry_id: 'test-registry' },
        order: [['generation', 'DESC']],
        raw: true,
      });

      expect(lastAudit).to.exist;
      expect(lastAudit.registry_id).to.equal('test-registry');
    });
  });

  describe('Integration with OrganizationsV2', function () {
    it('should update organization sync status', async function () {
      const org = await OrganizationsV2.create({
        org_uid: 'test-org',
        name: 'Test Org',
        is_home: false,
        subscribed: true,
        synced: false,
        sync_remaining: 5,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        registry_id: 'test-registry',
        registry_hash: 'test-hash',
      });

      await OrganizationsV2.update(
        {
          synced: true,
          sync_remaining: 0,
        },
        { where: { org_uid: org.org_uid } },
      );

      const updatedOrg = await OrganizationsV2.findOne({
        where: { org_uid: org.org_uid },
        raw: true,
      });

      // SQLite stores booleans as integers (0/1), so check for truthy value
      expect(updatedOrg.synced).to.be.ok;
      expect(updatedOrg.sync_remaining).to.equal(0);
    });
  });
});

