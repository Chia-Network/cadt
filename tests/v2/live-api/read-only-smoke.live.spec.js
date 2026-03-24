import { expect } from 'chai';
import { getLiveApiRequest } from './helpers/live-api-helpers.js';
import { READ_ONLY_ERROR } from '../../../src/utils/read-only-response.js';

describe('READ_ONLY Live API Smoke', function () {
  this.timeout(600000);

  let request;

  before(async function () {
    request = await getLiveApiRequest({ apiVersion: 'any' });
  });

  const expectReadOnlyBlock = (response) => {
    expect(response.status).to.equal(403);
    expect(response.body).to.deep.equal(READ_ONLY_ERROR);
  };

  it('confirms node is configured in read-only mode', async function () {
    const v1Health = await request.get('/v1/health/wallet');
    const v2Health = await request.get('/v2/health/wallet');

    expect(v1Health.status).to.equal(200);
    expect(v2Health.status).to.equal(200);
    expect(v1Health.body.readOnly).to.equal(true);
    expect(v2Health.body.readOnly).to.equal(true);
  });

  it('blocks representative write endpoints with canonical 403 payload', async function () {
    const v1Write = await request.post('/v1/governance').send({});
    const v2Write = await request.post('/v2/governance').send({});

    expectReadOnlyBlock(v1Write);
    expectReadOnlyBlock(v2Write);
  });

  it('blocks GET sync endpoints that trigger writes', async function () {
    const v1Sync = await request.get('/v1/governance/sync');
    const v2Sync = await request.get('/v2/governance/sync');

    expectReadOnlyBlock(v1Sync);
    expectReadOnlyBlock(v2Sync);
  });

  it('allows safe GET health endpoints', async function () {
    const v1Health = await request.get('/v1/health');
    const v2Health = await request.get('/v2/health');

    expect(v1Health.status).to.equal(200);
    expect(v2Health.status).to.equal(200);
  });
});
