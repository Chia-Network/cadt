import { expect } from 'chai';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';

/**
 * Phase 16.6: Verify No Auto-Creation on Startup
 *
 * This test verifies that V2 organizations are NOT automatically created
 * when the server starts or when the database is initialized.
 */
describe('Phase 16.6: Verify No Auto-Creation on Startup', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');

    // Clean up any existing V2 orgs from previous test runs
    await OrganizationsV2.destroy({ where: { is_home: true } });

    // Initialize database (this should NOT create any orgs)
    await prepareV2Db();
  });

  it('should not create V2 organization on database initialization', async function () {
    // After prepareV2Db() runs, check that no V2 org exists
    const v2Orgs = await OrganizationsV2.findAll({
      where: { is_home: true },
    });

    expect(v2Orgs.length).to.equal(0, 'V2 organization should not be auto-created on database initialization');
  });

  it('should not have any V2 organizations in database after startup', async function () {
    // Verify organizations table is empty (or only has non-home orgs if any)
    const allV2Orgs = await OrganizationsV2.findAll();
    const homeOrgs = allV2Orgs.filter(org => org.is_home === true);

    expect(homeOrgs.length).to.equal(0, 'No V2 home organizations should exist after startup');
  });

  it('should require explicit API call to create V2 organization', async function () {
    // This test documents the expected behavior:
    // V2 orgs should only be created via:
    // - POST /v2/organizations (new users)
    // - POST /v2/organizations/upgrade (existing users)

    // Verify no org exists
    const existingOrg = await OrganizationsV2.findOne({
      where: { is_home: true },
    });

    expect(existingOrg).to.be.null;

    // Note: Actual creation tests are in organizations-v2.spec.js
    // This test just verifies the initial state is correct
  });
});

