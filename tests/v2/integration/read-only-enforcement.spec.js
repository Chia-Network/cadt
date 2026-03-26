import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareDb } from '../../../src/database/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { createV2TestHomeOrg, withConfigOverride } from '../utils/v2-test-helpers.js';
import { READ_ONLY_ERROR } from '../../../src/utils/read-only-response.js';
import { createTestHomeOrg } from '../../test-fixtures/index.js';

describe('READ_ONLY enforcement', function () {
  this.timeout(30000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    await createTestHomeOrg();
    await createV2TestHomeOrg();
  });

  const assertReadOnlyResponse = (response) => {
    expect(response.status).to.equal(403);
    expect(response.body).to.deep.equal(READ_ONLY_ERROR);
  };

  it('blocks representative write methods via middleware when READ_ONLY=true', async function () {
    await withConfigOverride(async () => {
      const postResponse = await supertest(app)
        .post('/v2/governance')
        .send({});

      const putResponse = await supertest(app)
        .put('/v2/organizations/subscribe')
        .send({ orgUid: 'test-org' });

      const deleteResponse = await supertest(app)
        .delete('/v1/organizations/nonexistent-org');

      assertReadOnlyResponse(postResponse);
      assertReadOnlyResponse(putResponse);
      assertReadOnlyResponse(deleteResponse);
    }, { APP: { READ_ONLY: true } });
  });

  it('blocks GET sync endpoints that perform writes via controller guards', async function () {
    await withConfigOverride(async () => {
      const v1Response = await supertest(app).get('/v1/governance/sync');
      const v2Response = await supertest(app).get('/v2/governance/sync');

      assertReadOnlyResponse(v1Response);
      assertReadOnlyResponse(v2Response);
    }, { APP: { READ_ONLY: true } });
  });

  it('allows safe GET endpoints when READ_ONLY=true', async function () {
    await withConfigOverride(async () => {
      await supertest(app).get('/v1/health').expect(200);
      await supertest(app).get('/v2/health').expect(200);
    }, { APP: { READ_ONLY: true } });
  });

  it('suppresses wallet fields on organization read endpoints in read-only mode', async function () {
    await withConfigOverride(async () => {
      const v1Response = await supertest(app).get('/v1/organizations').expect(200);
      const v2Response = await supertest(app).get('/v2/organizations').expect(200);

      const v1HomeOrg = Object.values(v1Response.body).find((org) => org.isHome);
      const v2HomeOrg = Object.values(v2Response.body).find((org) => org.is_home);

      expect(v1HomeOrg).to.exist;
      expect(v2HomeOrg).to.exist;
      expect(v1HomeOrg).to.not.have.property('xchAddress');
      expect(v1HomeOrg).to.not.have.property('balance');
      expect(v2HomeOrg).to.not.have.property('xchAddress');
      expect(v2HomeOrg).to.not.have.property('balance');
    }, { APP: { READ_ONLY: true } });
  });
});
