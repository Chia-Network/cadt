import { expect } from 'chai';
import { getSharedRequest } from './helpers/shared-setup.js';
import { getFirstCreatedId, getFirstRecordIdFromDatabase } from './helpers/shared-state.js';
import { clearStagingTable } from './helpers/live-api-helpers.js';

describe('V2 DELETE reference guard (live)', function () {
  this.timeout(600000);
  let request;

  before(async function () {
    request = getSharedRequest();
  });

  after(async function () {
    await clearStagingTable(request);
  });

  describe('Step 8: DELETE Reference Guard Tests', function () {
    it('should return 409 when deleting project-methodology referenced by issuance', async function () {
      let pmId = getFirstCreatedId('project-methodology');
      if (!pmId) {
        pmId = await getFirstRecordIdFromDatabase(request, 'project-methodology');
      }
      if (!pmId) {
        this.skip();
      }
      const res = await request.delete(`/v2/project-methodology/${pmId}`);
      expect(res.status).to.equal(409);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.equal('Referenced records must be removed before deletion');
      expect(res.body.references).to.be.an('array');
      expect(res.body.references.some((r) => r.table === 'issuance' && r.count >= 1)).to.be.true;
    });

    it('should return 409 when deleting methodology referenced by project-methodology', async function () {
      let methodologyId = getFirstCreatedId('methodology');
      if (!methodologyId) {
        methodologyId = await getFirstRecordIdFromDatabase(request, 'methodology');
      }
      if (!methodologyId) {
        this.skip();
      }
      const res = await request.delete(`/v2/methodology/${methodologyId}`);
      expect(res.status).to.equal(409);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.equal('Referenced records must be removed before deletion');
      expect(res.body.references.some((r) => r.table === 'project_methodology' && r.count >= 1)).to.be.true;
    });
  });
});
