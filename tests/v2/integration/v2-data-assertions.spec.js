import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, OrganizationsV2, MetaV2 } from '../../../src/models/v2/index.js';
import {
  assertRecordExistanceOrStaged,
  isRecordStaged,
  getStagedRecords,
  assertStagingTableNotEmpty,
  assertStagingTableIsEmpty,
  assertNoPendingCommitsExcludingTransfers,
  assertCanBeGovernanceBodyV2,
  assertIsActiveGovernanceBodyV2,
} from '../../../src/utils/v2-data-assertions.js';
import { withConfigOverride } from '../utils/v2-test-helpers.js';

describe('V2 Data Assertions - Utility Functions Test', function () {
  this.timeout(10000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  describe('assertRecordExistanceOrStaged', function () {
    it('should find record in main table when it exists', async function () {
      // Create a test meta record instead (simpler)
      // Use a unique key to avoid conflicts
      const uniqueKey = `test-key-main-${Date.now()}-${Math.random()}`;
      const meta = await MetaV2.create({
        meta_key: uniqueKey,
        meta_value: 'test-value-main',
      });

      // Should find the record in main table
      const foundRecord = await assertRecordExistanceOrStaged(MetaV2, meta.id, 'id');
      expect(foundRecord).to.exist;
      expect(foundRecord.id).to.equal(meta.id);
      expect(foundRecord._isStaged).to.be.undefined; // Not staged
    });

    it('should find record in staging table when not in main table', async function () {
      // Create a staging record
      const testData = {
        id: 999, // Use a unique ID
        org_uid: 'staged-org-456',
        name: 'Staged Organization',
        is_home: false,
        registry_id: 'staged-registry',
        registry_hash: 'staged-hash',
        subscribed: false,
        synced: false,
        file_store_subscribed: null,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        data_model_version_store_id: null,
        data_model_version_store_hash: null,
      };

      await StagingV2.create({
        uuid: 'test-uuid-123',
        table: 'organizations',
        action: 'INSERT',
        data: JSON.stringify([testData]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      // Should find the record in staging
      const foundRecord = await assertRecordExistanceOrStaged(OrganizationsV2, 999, 'id');
      expect(foundRecord).to.exist;
      expect(foundRecord.id).to.equal(999);
      expect(foundRecord._isStaged).to.be.true;
      expect(foundRecord._stagingUuid).to.equal('test-uuid-123');
    });

    it('should throw error when record not found in either location', async function () {
      try {
        await assertRecordExistanceOrStaged(MetaV2, 99999, 'id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('MetaV2 does not have a record for 99999');
      }
    });
  });

  describe('isRecordStaged', function () {
    it('should return true when record is staged', async function () {
      const testData = {
        id: 888, // Use a unique ID
        meta_key: 'test-key',
        meta_value: 'test-value',
      };

      await StagingV2.create({
        uuid: 'test-uuid-456',
        table: 'meta',
        action: 'INSERT',
        data: JSON.stringify([testData]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const isStaged = await isRecordStaged(MetaV2, 888, 'id');
      expect(isStaged).to.be.true;
    });

    it('should return false when record is not staged', async function () {
      const isStaged = await isRecordStaged(MetaV2, 77777, 'id');
      expect(isStaged).to.be.false;
    });
  });

  describe('getStagedRecords', function () {
    it('should return all staged records for a table', async function () {
      // Clear staging table first to ensure clean test
      await StagingV2.destroy({ truncate: true });

      const testData1 = {
        id: 111,
        meta_key: 'key1',
        meta_value: 'value1',
      };

      const testData2 = {
        id: 222,
        meta_key: 'key2',
        meta_value: 'value2',
      };

      await StagingV2.create({
        uuid: 'test-uuid-789',
        table: 'meta',
        action: 'INSERT',
        data: JSON.stringify([testData1, testData2]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const stagedRecords = await getStagedRecords(MetaV2);
      expect(stagedRecords).to.have.length(2);
      expect(stagedRecords[0].meta_key).to.equal('key1');
      expect(stagedRecords[1].meta_key).to.equal('key2');
      expect(stagedRecords[0]._isStaged).to.be.true;
    });
  });

  describe('Staging Table Assertions', function () {
    it('should pass when staging table is not empty', async function () {
      // Create a staging record
      await StagingV2.create({
        uuid: 'test-uuid-empty-check',
        table: 'meta',
        action: 'INSERT',
        data: JSON.stringify([{ meta_key: 'test', meta_value: 'test' }]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      // Should not throw
      await assertStagingTableNotEmpty();
    });

    it('should throw when staging table is empty', async function () {
      // Clear staging table
      await StagingV2.destroy({ truncate: true });

      try {
        await assertStagingTableNotEmpty();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Staging table is empty');
      }
    });

    it('should pass when staging table is empty', async function () {
      // Clear staging table
      await StagingV2.destroy({ truncate: true });

      // Should not throw
      await assertStagingTableIsEmpty();
    });

    it('should throw when staging table is not empty', async function () {
      // Create a staging record
      await StagingV2.create({
        uuid: 'test-uuid-not-empty',
        table: 'meta',
        action: 'INSERT',
        data: JSON.stringify([{ meta_key: 'test', meta_value: 'test' }]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      try {
        await assertStagingTableIsEmpty();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Staging table is not empty');
      }
    });

    it('should pass when no pending commits excluding transfers', async function () {
      // Clear staging table
      await StagingV2.destroy({ truncate: true });

      // Should not throw
      await assertNoPendingCommitsExcludingTransfers();
    });

    it('should throw when there are pending commits excluding transfers', async function () {
      // Create a non-transfer staging record with committed: true (pending commit)
      await StagingV2.create({
        uuid: 'test-uuid-pending',
        table: 'meta',
        action: 'INSERT',
        data: JSON.stringify([{ meta_key: 'test', meta_value: 'test' }]),
        committed: true, // This is a pending commit
        failed_commit: false,
        is_transfer: false, // Not a transfer
      });

      try {
        await assertNoPendingCommitsExcludingTransfers();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('There are pending commits in staging table');
      }
    });

    it('should pass when only transfer records are pending', async function () {
      // Clear staging table
      await StagingV2.destroy({ truncate: true });

      // Create a transfer staging record
      await StagingV2.create({
        uuid: 'test-uuid-transfer',
        table: 'meta',
        action: 'INSERT',
        data: JSON.stringify([{ meta_key: 'test', meta_value: 'test' }]),
        committed: false,
        failed_commit: false,
        is_transfer: true, // This is a transfer
      });

      // Should not throw because transfers are excluded
      await assertNoPendingCommitsExcludingTransfers();
    });
  });

  describe('governance assertions', function () {
    describe('assertCanBeGovernanceBodyV2', function () {
      it('should throw error when IS_GOVERNANCE_BODY is false in config', async function () {
        // Override config to set IS_GOVERNANCE_BODY to false in V2 section
        // This test verifies the assertion correctly throws when config is false
        await withConfigOverride(
          async () => {
            try {
              await assertCanBeGovernanceBodyV2();
              expect.fail('Should have thrown an error when IS_GOVERNANCE_BODY is false');
            } catch (error) {
              expect(error.message).to.include('You are not an governance body');
            }
          },
          { V2: { IS_GOVERNANCE_BODY: false } }
        );
      });

      it('should pass when IS_GOVERNANCE_BODY is true in config', async function () {
        // Use config override helper to temporarily set IS_GOVERNANCE_BODY to true
        await withConfigOverride(
          async () => {
            // Should not throw when IS_GOVERNANCE_BODY is true
            await assertCanBeGovernanceBodyV2();
            expect(true).to.be.true; // If we get here, assertion passed
          },
          { APP: { IS_GOVERNANCE_BODY: true } }
        );
      });
    });

    describe('assertIsActiveGovernanceBodyV2', function () {
      it('should pass when governanceBodyId exists in MetaV2', async function () {
        // Create governanceBodyId in MetaV2
        await MetaV2.create({
          meta_key: 'governanceBodyId',
          meta_value: 'test-governance-body-id-123',
        });

        // Should not throw
        await assertIsActiveGovernanceBodyV2();

        // Clean up
        await MetaV2.destroy({ where: { meta_key: 'governanceBodyId' } });
      });

      it('should throw error when governanceBodyId does not exist in MetaV2', async function () {
        // Ensure governanceBodyId doesn't exist
        await MetaV2.destroy({ where: { meta_key: 'governanceBodyId' } });

        try {
          await assertIsActiveGovernanceBodyV2();
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).to.include('You are not an governance body');
        }
      });
    });
  });
});
