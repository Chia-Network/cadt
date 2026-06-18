import { expect } from 'chai';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import app from '../../src/server.js';
import { prepareDb, sequelize } from '../../src/database/index.js';
import { Audit } from '../../src/models/index.js';
import TaskManager from '../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../src/utils/config-loader.js';

describe('Audit Resource (V1) — list endpoint', function () {
  this.timeout(30000);

  let orgUid;

  before(async function () {
    await prepareDb();
    // Stop background sync so it doesn't hold the audit beforeFind mutex
    // or mutate the audit table mid-test.
    TaskManager.stopAll();
  });

  after(async function () {
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    TaskManager.start(configV1?.ENABLE !== false, configV2?.ENABLE !== false);
  });

  beforeEach(async function () {
    await Audit.destroy({ where: {} });
    orgUid = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    await Audit.bulkCreate([
      {
        orgUid,
        registryId: 'test-registry-1',
        rootHash: 'hash1',
        type: 'insert',
        change: '{"test": "data1"}',
        table: 'project',
        onchainConfirmationTimeStamp: now.toString(),
        generation: 1,
      },
      {
        orgUid,
        registryId: 'test-registry-1',
        rootHash: 'hash2',
        type: 'update',
        change: '{"test": "data2"}',
        table: 'project',
        onchainConfirmationTimeStamp: (now + 1).toString(),
        generation: 2,
      },
    ]);
  });

  describe('GET /v1/audit - pagination shape', function () {
    it('should return the paginated response shape', async function () {
      const response = await supertest(app)
        .get('/v1/audit')
        .query({ orgUid, page: 1, limit: 1 })
        .expect(200);

      expect(response.body).to.have.property('page', 1);
      expect(response.body).to.have.property('pageCount', 2);
      expect(response.body).to.have.property('data').that.is.an('array');
      expect(response.body.data).to.have.length(1);
    });
  });

  describe('GET /v1/audit - excludeChange parameter', function () {
    it('should include the change column by default', async function () {
      const response = await supertest(app)
        .get('/v1/audit')
        .query({ orgUid, page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.have.length(2);
      expect(response.body.data[0]).to.have.property('change');
      // raw:true must not regress the timestamp wire format away from ISO-8601
      expect(response.body.data[0].createdAt).to.match(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should omit the change column when excludeChange=true', async function () {
      const response = await supertest(app)
        .get('/v1/audit')
        .query({ orgUid, page: 1, limit: 10, excludeChange: true })
        .expect(200);

      expect(response.body.data).to.have.length(2);
      response.body.data.forEach((row) => {
        expect(row).to.not.have.property('change');
      });
      // Other columns are still present
      expect(response.body.data[0]).to.have.property('rootHash');
    });

    it('should include the change column when excludeChange=false', async function () {
      const response = await supertest(app)
        .get('/v1/audit')
        .query({ orgUid, page: 1, limit: 10, excludeChange: false })
        .expect(200);

      expect(response.body.data).to.have.length(2);
      expect(response.body.data[0]).to.have.property('change');
    });
  });

  describe('GET /v1/audit - limit cap', function () {
    it('should accept limit at the maximum bound (1000)', async function () {
      const response = await supertest(app)
        .get('/v1/audit')
        .query({ orgUid, page: 1, limit: 1000 })
        .expect(200);

      expect(response.body.data).to.have.length(2);
    });

    it('should reject limit above the maximum bound (1001)', async function () {
      const response = await supertest(app)
        .get('/v1/audit')
        .query({ orgUid, page: 1, limit: 1001 })
        .expect(400);

      const messages = response.body.errors || [response.body.error];
      expect(messages.some((m) => m && m.includes('Invalid limit value'))).to.be
        .true;
    });
  });

  describe('GET /v1/audit - query plan uses the covering index', function () {
    it('serves the list query from the composite index without a temp sort', async function () {
      const plan = await sequelize.query(
        "EXPLAIN QUERY PLAN SELECT * FROM audit WHERE orgUid = 'x' ORDER BY onchainConfirmationTimeStamp DESC LIMIT 1000",
        { type: sequelize.QueryTypes.SELECT },
      );
      const details = plan.map((row) => row.detail).join(' | ');

      expect(details).to.include('audit_org_uid_onchain_timestamp');
      expect(details).to.not.match(/TEMP B-TREE/i);
    });
  });
});
