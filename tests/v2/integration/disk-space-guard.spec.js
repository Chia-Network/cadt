import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareDb } from '../../../src/database/index.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';
import { createTestHomeOrg } from '../../test-fixtures/index.js';
import {
  __setDiskSpaceForTests,
  __resetDiskSpaceLogDebounceForTests,
  __invalidateDiskSpaceCacheForTests,
  buildInsufficientDiskSpaceError,
  BLOCK_BYTES,
  WARN_BYTES,
} from '../../../src/utils/disk-space.js';

const MB = 1024 * 1024;

const setDiskSeverity = (severity, overrides = {}) => {
  const free = (() => {
    switch (severity) {
      case 'block':
        return 100 * MB;
      case 'warn':
        return 800 * MB;
      case 'unknown':
        return null;
      default:
        return 50 * 1024 * MB; // 50 GB
    }
  })();
  __setDiskSpaceForTests({
    severity,
    freeBytes: free,
    blockBytes: BLOCK_BYTES,
    warnBytes: WARN_BYTES,
    path: '/fake/data/dir',
    error: severity === 'unknown' ? 'EACCES: fake' : null,
    ...overrides,
  });
};

describe('Disk-space guard enforcement', function () {
  this.timeout(30000);

  before(async function () {
    await prepareDb();
    await prepareV2Db();
    await createTestHomeOrg();
    await createV2TestHomeOrg();
  });

  beforeEach(function () {
    __resetDiskSpaceLogDebounceForTests();
    __invalidateDiskSpaceCacheForTests();
  });

  afterEach(function () {
    __setDiskSpaceForTests(null);
  });

  describe('when severity is "block"', function () {
    beforeEach(function () {
      setDiskSeverity('block');
    });

    it('rejects V2 POST writes with 507 INSUFFICIENT_DISK_SPACE', async function () {
      const response = await supertest(app).post('/v2/governance').send({});
      expect(response.status).to.equal(507);
      expect(response.body.error).to.equal('INSUFFICIENT_DISK_SPACE');
      expect(response.body.success).to.equal(false);
      expect(response.body.message).to.match(/low on disk space/i);
      // Body intentionally does not include freeBytes/thresholdBytes
      // (see comment on buildInsufficientDiskSpaceError) - the guard
      // runs before the API-key check and we don't want to leak
      // operational state to anonymous callers. /health exposes the
      // numeric values.
      expect(response.body).to.not.have.property('freeBytes');
      expect(response.body).to.not.have.property('thresholdBytes');
    });

    it('rejects V2 PUT writes with 507 INSUFFICIENT_DISK_SPACE', async function () {
      const response = await supertest(app)
        .put('/v2/organizations/subscribe')
        .send({ orgUid: 'test-org' });
      expect(response.status).to.equal(507);
      expect(response.body.error).to.equal('INSUFFICIENT_DISK_SPACE');
    });

    it('rejects V1 POST writes with 507 INSUFFICIENT_DISK_SPACE (same gate as V2)', async function () {
      // Belt-and-suspenders: the guard sits in shared middleware and
      // gates on req.method, not URL prefix. Verify V1 routes are
      // covered too so a future routing change can't silently bypass.
      const response = await supertest(app).post('/v1/projects').send({});
      expect(response.status).to.equal(507);
      expect(response.body.error).to.equal('INSUFFICIENT_DISK_SPACE');
    });

    it('allows DELETE so operators can free space', async function () {
      // We don't care whether the underlying resource exists; the
      // assertion is that we did NOT short-circuit with 507. The
      // controller may return 404 or 400 for "no such org" - anything
      // other than 507 satisfies "the guard let it through".
      const response = await supertest(app).delete(
        '/v1/organizations/nonexistent-org',
      );
      expect(response.status).to.not.equal(507);
    });

    it('allows GET reads', async function () {
      const response = await supertest(app).get('/v2/organizations');
      expect(response.status).to.not.equal(507);
    });

    it('allows /health and reports severity', async function () {
      const response = await supertest(app).get('/health');
      expect(response.status).to.equal(200);
      expect(response.body.diskSpace).to.include({ severity: 'block' });
      expect(response.body.diskSpace.freeBytes).to.equal(100 * MB);
      expect(response.body.diskSpace.blockBytes).to.equal(BLOCK_BYTES);
    });

    it('allows /v1/health and /v2/health with disk status', async function () {
      const v1 = await supertest(app).get('/v1/health');
      const v2 = await supertest(app).get('/v2/health');
      expect(v1.status).to.equal(200);
      expect(v2.status).to.equal(200);
      expect(v1.body.diskSpace.severity).to.equal('block');
      expect(v2.body.diskSpace.severity).to.equal('block');
    });
  });

  describe('when severity is "warn"', function () {
    beforeEach(function () {
      setDiskSeverity('warn');
    });

    it('still permits POST writes (does not return 507) and reports warn on /health', async function () {
      const response = await supertest(app).post('/v2/governance').send({});
      // Whatever the controller decides (validation error, etc.) is fine;
      // the guard must not have short-circuited with 507.
      expect(response.status).to.not.equal(507);

      // Tighten the assertion: confirm the seeded warn status was actually
      // consumed by the guard (otherwise the "not 507" check above would
      // pass for any controller-level 4xx, including bugs that bypass the
      // guard entirely).
      const health = await supertest(app).get('/health');
      expect(health.body.diskSpace.severity).to.equal('warn');
      expect(health.body.diskSpace.freeBytes).to.equal(800 * MB);
    });

    it('exposes warn severity on /health', async function () {
      const response = await supertest(app).get('/health');
      expect(response.body.diskSpace.severity).to.equal('warn');
    });
  });

  describe('when severity is "ok"', function () {
    beforeEach(function () {
      setDiskSeverity('ok');
    });

    it('permits all methods', async function () {
      const postResponse = await supertest(app).post('/v2/governance').send({});
      expect(postResponse.status).to.not.equal(507);

      const getResponse = await supertest(app).get('/v2/organizations');
      expect(getResponse.status).to.not.equal(507);
    });

    it('reports ok severity on /health', async function () {
      const response = await supertest(app).get('/health');
      expect(response.body.diskSpace.severity).to.equal('ok');
    });
  });

  describe('when severity is "unknown" (statfs failed)', function () {
    beforeEach(function () {
      setDiskSeverity('unknown');
    });

    it('fails open: writes are NOT rejected so a buggy filesystem cannot take CADT offline', async function () {
      const response = await supertest(app).post('/v2/governance').send({});
      expect(response.status).to.not.equal(507);
    });

    it('surfaces unknown severity on /health for monitoring', async function () {
      const response = await supertest(app).get('/health');
      expect(response.body.diskSpace.severity).to.equal('unknown');
      expect(response.body.diskSpace.freeBytes).to.equal(null);
    });
  });

  describe('error body shape', function () {
    it('buildInsufficientDiskSpaceError matches the canonical READ_ONLY shape and leaks no state', function () {
      const body = buildInsufficientDiskSpaceError();
      expect(body).to.have.property('message');
      expect(body).to.have.property('error', 'INSUFFICIENT_DISK_SPACE');
      expect(body).to.have.property('success', false);
      // Numeric fields are intentionally excluded - see the comment on
      // buildInsufficientDiskSpaceError. /health remains the channel
      // for the actual numbers.
      expect(body).to.not.have.property('freeBytes');
      expect(body).to.not.have.property('thresholdBytes');
    });
  });
});
