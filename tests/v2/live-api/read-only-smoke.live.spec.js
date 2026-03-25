import { expect } from 'chai';
import { getLiveApiRequest } from './helpers/live-api-helpers.js';
import { READ_ONLY_ERROR } from '../../../src/utils/read-only-response.js';

describe('READ_ONLY Live API Smoke', function () {
  this.timeout(600000);

  let request;
  const canaryWriteEndpoints = [
    { method: 'post', path: '/v1/governance', label: 'v1 governance create' },
    { method: 'post', path: '/v1/organization/sync', label: 'v1 organization sync' },
    { method: 'delete', path: '/v1/staging/clean', label: 'v1 staging clean' },
    { method: 'post', path: '/v1/filestore/add_file', label: 'v1 filestore add file' },
    { method: 'post', path: '/v2/governance', label: 'v2 governance create' },
    { method: 'post', path: '/v2/organizations/sync', label: 'v2 organizations sync' },
    { method: 'delete', path: '/v2/staging/clean', label: 'v2 staging clean' },
    { method: 'post', path: '/v2/filestore/add_file', label: 'v2 filestore add file' },
  ];
  const canaryWriteLikeGetEndpoints = [
    { path: '/v1/governance/sync', label: 'v1 governance sync (GET side effects)' },
    { path: '/v2/governance/sync', label: 'v2 governance sync (GET side effects)' },
    { path: '/v1/offer', label: 'v1 offer generate (GET side effects)' },
    { path: '/v2/offer', label: 'v2 offer generate (GET side effects)' },
  ];

  before(async function () {
    request = await getLiveApiRequest({ apiVersion: 'any' });
  });

  const expectReadOnlyBlock = (response, endpointLabel) => {
    expect(response.status, endpointLabel).to.equal(403);
    expect(response.body, endpointLabel).to.deep.equal(READ_ONLY_ERROR);
  };

  it('confirms node is configured in read-only mode', async function () {
    const v1Health = await request.get('/v1/health/wallet');
    const v2Health = await request.get('/v2/health/wallet');

    expect(v1Health.status).to.equal(200);
    expect(v2Health.status).to.equal(200);
    expect(v1Health.body.readOnly).to.equal(true);
    expect(v2Health.body.readOnly).to.equal(true);
  });

  it('blocks canary write endpoints with canonical 403 payload', async function () {
    for (const endpoint of canaryWriteEndpoints) {
      const response = await request[endpoint.method](endpoint.path).send({});
      expectReadOnlyBlock(response, endpoint.label);
    }
  });

  it('blocks canary GET endpoints with write-side effects', async function () {
    for (const endpoint of canaryWriteLikeGetEndpoints) {
      const response = await request.get(endpoint.path);
      expectReadOnlyBlock(response, endpoint.label);
    }
  });

  it('allows safe GET health endpoints', async function () {
    const v1Health = await request.get('/v1/health');
    const v2Health = await request.get('/v2/health');

    expect(v1Health.status).to.equal(200);
    expect(v2Health.status).to.equal(200);
  });
});
