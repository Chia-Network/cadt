import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { prepareDb } from '../../../src/database/index.js';
import { GovernanceV2 } from '../../../src/models/v2/index.js';
import { Governance } from '../../../src/models/governance/governance.model.js';
import TaskManager from '../../../src/tasks/index.js';

/**
 * Governance Sync Unsynced Stores Tests
 *
 * The sync pre-check guards are production-only (process.env.USE_SIMULATOR
 * forces USE_SIMULATOR=true in the test runner, which makes the check branch
 * unreachable).  These tests instead verify observable simulator-mode
 * behaviour: cached data is preserved between sync calls, and the methods
 * complete without error.
 *
 * Key invariants proven here:
 *   1. sync() in simulator mode upserts stub pickList and returns immediately
 *   2. Governance records that were NOT written by the current sync() call
 *      are left untouched (simulates "cached data preserved on skip")
 *   3. Both V1 and V2 sync() are reachable and error-free
 */
describe('Governance Sync Unsynced Stores', function () {
  this.timeout(10000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    TaskManager.stopAll();
  });

  afterEach(async function () {
    await GovernanceV2.destroy({ where: {} });
  });

  // ─────────────────────────────────────────────────────────
  // V2 GovernanceV2.sync - simulator mode
  // ─────────────────────────────────────────────────────────

  describe('V2 GovernanceV2.sync - simulator mode', function () {
    it('should upsert stub pickList on every sync call', async function () {
      await GovernanceV2.sync();
      const pickList = await GovernanceV2.findOne({ where: { meta_key: 'pickList' } });
      expect(pickList).to.exist;
      expect(pickList.confirmed).to.be.true;
    });

    it('should not remove previously cached orgList when only pickList is written', async function () {
      // In simulator mode, sync() only writes pickList.
      // Pre-existing orgList (representing cached governance data) must be
      // preserved — analogous to what happens when sync fast-fails on an
      // unsynced store in production mode.
      await GovernanceV2.upsert({
        meta_key: 'orgList',
        meta_value: JSON.stringify({ orgs: ['existing-org'] }),
        confirmed: true,
      });

      await GovernanceV2.sync();

      const orgList = await GovernanceV2.findOne({ where: { meta_key: 'orgList' } });
      expect(orgList).to.exist;
      expect(JSON.parse(orgList.meta_value)).to.deep.equal({ orgs: ['existing-org'] });
    });

    it('should not remove previously cached glossary when only pickList is written', async function () {
      await GovernanceV2.upsert({
        meta_key: 'glossary',
        meta_value: JSON.stringify({ terms: ['carbon credit'] }),
        confirmed: true,
      });

      await GovernanceV2.sync();

      const glossary = await GovernanceV2.findOne({ where: { meta_key: 'glossary' } });
      expect(glossary).to.exist;
      expect(JSON.parse(glossary.meta_value)).to.deep.equal({ terms: ['carbon credit'] });
    });

    it('should complete without error when called multiple times', async function () {
      await GovernanceV2.sync();
      await GovernanceV2.sync();
      const pickList = await GovernanceV2.findOne({ where: { meta_key: 'pickList' } });
      expect(pickList).to.exist;
    });

    it('should complete quickly in simulator mode', async function () {
      const start = Date.now();
      await GovernanceV2.sync();
      expect(Date.now() - start).to.be.below(1000, 'simulator sync should be near-instantaneous');
    });
  });

  // ─────────────────────────────────────────────────────────
  // V1 Governance.sync - simulator mode
  // ─────────────────────────────────────────────────────────

  describe('V1 Governance.sync - simulator mode', function () {
    it('should be available as a static method', function () {
      expect(Governance.sync).to.be.a('function');
    });

    it('should complete without error in simulator mode', async function () {
      let threw = false;
      try {
        await Governance.sync();
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });

    it('should complete quickly in simulator mode', async function () {
      const start = Date.now();
      await Governance.sync();
      expect(Date.now() - start).to.be.below(1000);
    });
  });
});
