import { expect } from 'chai';
import {
  getLiveApiRequest,
} from '../helpers/live-api-helpers.js';
import {
  getOrganizationState,
  clearOrganizationState,
} from '../helpers/organization-state.js';

describe('Organization Deletion Tests', function () {
  this.timeout(600000); // 10 minute timeout

  let request;

  before(async function () {
    request = await getLiveApiRequest();
  });

  describe('Organization Cleanup', function () {
    it('should delete all created organizations', async function () {
      const state = getOrganizationState();

      if (!state.upgradedV2OrgUid && !state.v1OrgUid && !state.v2OrgUid) {
        console.log('⚠️  No organization UIDs found in state file - skipping deletion');
        console.log('   This is expected if organization-create tests were not run');
        return;
      }

      // Delete upgraded V2 organization if it exists
      if (state.upgradedV2OrgUid) {
        const deleteV2Response = await request
          .delete(`/v2/organizations/${state.upgradedV2OrgUid}`)
          .expect(200);

        expect(deleteV2Response.body.success).to.be.true;
        console.log(`✓ Upgraded V2 Organization deleted: ${state.upgradedV2OrgUid}`);
      }

      // Delete original V1 organization if it exists
      if (state.v1OrgUid) {
        const deleteV1Response = await request
          .delete(`/v1/organizations/${state.v1OrgUid}`)
          .expect(200);

        expect(deleteV1Response.body.success).to.be.true;
        console.log(`✓ V1 Organization deleted: ${state.v1OrgUid}`);
      }

      // Delete V2 org if it exists (from the first test)
      if (state.v2OrgUid) {
        const deleteV2Response = await request
          .delete(`/v2/organizations/${state.v2OrgUid}`)
          .expect(200);

        expect(deleteV2Response.body.success).to.be.true;
        console.log(`✓ V2 Organization deleted: ${state.v2OrgUid}`);
      }

      // Clear organization state after successful deletion
      clearOrganizationState();
      console.log('✓ All organizations deleted and state cleared');
    });
  });
});
