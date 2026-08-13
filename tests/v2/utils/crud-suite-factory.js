import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { StagingV2 } from '../../../src/models/v2/index.js';

// Any value works for the forbidden-field cases: the API rejects on presence.
const FORBIDDEN_FIELD_VALUE = '2024-01-01T00:00:00Z';

// Field entries accept a bare name or `{ field, message }` when a resource
// asserts on more of the error string than the field name alone.
const asFieldEntry = (entry) => (typeof entry === 'string' ? { field: entry } : entry);

const expectFieldError = (response, { field, message }) => {
  expect(response.body.success).to.be.false;
  expect(response.body.error).to.include(message ?? field);
};

// Mirrors the production staging readers, which skip rows they cannot parse
// rather than letting one bad row throw.
const parseStagedRow = (row) => {
  try {
    const parsed = JSON.parse(row.data);
    return Array.isArray(parsed) ? parsed[0] : undefined;
  } catch {
    return undefined;
  }
};

const expectStagedRow = async (where) => {
  const record = await StagingV2.findOne({ where });
  expect(record).to.exist;
  expect(record.committed).to.be.false;

  const data = parseStagedRow(record);
  expect(data, `staged payload for ${record.uuid}`).to.exist;
  return { record, data };
};

// Not every resource spec truncates staging between tests, so mutations are
// matched on the row they target rather than on the first row for the table.
const expectStagedRowFor = async ({ table, action, pkColumn, id }) => {
  const rows = await StagingV2.findAll({ where: { table, action } });
  const matches = rows.filter((row) => parseStagedRow(row)?.[pkColumn] === id);

  expect(matches, `staged ${action} rows for ${table} ${id}`).to.have.lengthOf(1);
  expect(matches[0].committed).to.be.false;
  return parseStagedRow(matches[0]);
};

/**
 * Emits the CRUD/staging cases every core V2 resource shares: the 404 trio,
 * empty and populated list reads, staged INSERT/UPDATE/DELETE, and the
 * missing-required, forbidden-timestamp, and picklist rejection batteries.
 *
 * Call it from inside a resource's own top-level `describe` so the emitted cases
 * reuse that file's hooks, and pass fixtures those hooks rebuild per test through
 * `context` rather than capturing them at call time. The emitted describes are
 * named after the endpoint, matching the blocks the specs already use for their
 * resource-specific cases.
 *
 * `updatePayload` and `seed` gate the staged UPDATE and DELETE cases; `list`
 * gates the populated list case. Omit them for resources that have no such case.
 * `notFoundPayload` supplies a body for the PUT 404 case; give it one that fails
 * schema validation where the controller checks existence before validating, so
 * that ordering stays pinned.
 * `requiredFields` and `forbiddenFields` take either a bare field name or
 * `{ field, message }`; picklists use `invalidMessage` for the same purpose.
 * Supply the longer string wherever a resource asserts on more of the error
 * than the field name.
 */
// `seed`, `updatePayload`, and `list` gate whole cases, so a misspelled key
// would drop coverage while the suite still reports green.
const CONFIG_KEYS = new Set([
  'resource', 'label', 'plural', 'endpoint', 'table', 'pk', 'pkColumn', 'missingId',
  'context', 'validPayload', 'updatePayload', 'notFoundPayload', 'seed',
  'requiredFields', 'forbiddenFields', 'picklists', 'list',
  'expectStagedInsert', 'expectStagedUpdate', 'expectDeleteResponse',
  'notFoundMessage', 'createdMessage', 'updatedMessage', 'deletedMessage',
]);

// An omitted `missingId` or `pk` yields a `/undefined` path that still 404s, so
// the 404 cases would pass without ever exercising the option.
const REQUIRED_KEYS = ['resource', 'label', 'missingId', 'validPayload'];
const REQUIRED_WITH_SEED = ['pk', 'pkColumn'];

export const runCrudStagingSuite = (cfg) => {
  const unknownKeys = Object.keys(cfg).filter((key) => !CONFIG_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`runCrudStagingSuite: unknown config key(s): ${unknownKeys.join(', ')}`);
  }

  const required = cfg.seed ? [...REQUIRED_KEYS, ...REQUIRED_WITH_SEED] : REQUIRED_KEYS;
  const missingKeys = required.filter((key) => cfg[key] === undefined);
  if (missingKeys.length > 0) {
    throw new Error(`runCrudStagingSuite: missing config key(s): ${missingKeys.join(', ')}`);
  }

  const {
    resource,
    label,
    plural = `${resource}s`,
    endpoint = `/v2/${resource}`,
    table = resource,
    pk,
    pkColumn,
    missingId,
    context = () => ({}),
    validPayload,
    updatePayload,
    notFoundPayload,
    seed,
    requiredFields = [],
    forbiddenFields = ['createdAt', 'updatedAt'],
    picklists = [],
    list,
    expectStagedInsert,
    expectStagedUpdate,
    expectDeleteResponse,
    notFoundMessage = `${label} not found`,
    createdMessage = `${label} staged successfully`,
    updatedMessage = `${label} update staged successfully`,
    deletedMessage = `${label} delete staged successfully`,
  } = cfg;

  const expectNotFound = async (request) => {
    const response = await request.expect(404);
    expect(response.body.message).to.equal(notFoundMessage);
    expect(response.body.success).to.be.false;
  };

  describe(`POST ${endpoint} (Create)`, function () {
    it(`should create a new ${resource} record`, async function () {
      const ctx = context();

      const response = await supertest(app).post(endpoint).send(validPayload(ctx));

      expect(response.status, JSON.stringify(response.body)).to.equal(200);
      expect(response.body.message).to.equal(createdMessage);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('uuid');

      const { record, data } = await expectStagedRow({ uuid: response.body.uuid });
      expect(record.table).to.equal(table);
      expect(record.action).to.equal('INSERT');
      await expectStagedInsert?.(data, ctx);
    });

    requiredFields.map(asFieldEntry).forEach(({ field, message }) => {
      it(`should reject ${resource} without required ${field}`, async function () {
        const payload = validPayload(context());
        delete payload[field];

        const response = await supertest(app).post(endpoint).send(payload).expect(400);

        expectFieldError(response, { field, message });
      });
    });

    forbiddenFields.map(asFieldEntry).forEach(({ field, message }) => {
      it(`should reject ${resource} with forbidden ${field} field`, async function () {
        const payload = { ...validPayload(context()), [field]: FORBIDDEN_FIELD_VALUE };

        const response = await supertest(app).post(endpoint).send(payload).expect(400);

        expectFieldError(response, { field, message });
      });
    });

    picklists.forEach(({ field, invalid, valid, invalidMessage, invalidTitle, validTitle }) => {
      it(invalidTitle ?? `should reject ${resource} with invalid ${field} (not in V2 picklist)`, async function () {
        const payload = { ...validPayload(context()), [field]: invalid };

        const response = await supertest(app).post(endpoint).send(payload).expect(400);

        expectFieldError(response, { field, message: invalidMessage });
      });

      it(validTitle ?? `should accept ${resource} with valid V2 ${field}`, async function () {
        const payload = { ...validPayload(context()), [field]: valid };

        const response = await supertest(app).post(endpoint).send(payload).expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.equal(createdMessage);
        expect(response.body).to.have.property('uuid');
      });
    });
  });

  describe(`GET ${endpoint} (List)`, function () {
    it(`should return empty array when no ${plural} exist`, async function () {
      const response = await supertest(app)
        .get(endpoint)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(0);
    });

    if (list) {
      it(list.title ?? `should return ${plural} from database`, async function () {
        const ctx = context();
        await list.seed(ctx);

        const response = await supertest(app)
          .get(endpoint)
          .query({ page: 1, limit: 10, ...list.query })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length(1);
        await list.expectRow(response.body.data[0], ctx);
      });
    }
  });

  describe(`GET ${endpoint}/:id (Get One)`, function () {
    it(`should return 404 for non-existent ${resource}`, async function () {
      await expectNotFound(supertest(app).get(`${endpoint}/${missingId}`));
    });
  });

  describe(`PUT ${endpoint}/:id (Update)`, function () {
    it(`should return 404 for non-existent ${resource}`, async function () {
      const payload = (notFoundPayload ?? updatePayload ?? validPayload)(context());

      await expectNotFound(supertest(app).put(`${endpoint}/${missingId}`).send(payload));
    });

    if (seed && updatePayload) {
      it(`should stage ${resource} update`, async function () {
        const ctx = context();
        const record = await seed(ctx);

        const response = await supertest(app)
          .put(`${endpoint}/${record[pk]}`)
          .send(updatePayload(ctx));

        expect(response.status, JSON.stringify(response.body)).to.equal(200);
        expect(response.body.message).to.equal(updatedMessage);
        expect(response.body.success).to.be.true;

        const staged = await expectStagedRowFor({
          table,
          action: 'UPDATE',
          pkColumn,
          id: record[pk],
        });
        await expectStagedUpdate?.(staged, ctx);
      });
    }
  });

  describe(`DELETE ${endpoint}/:id (Delete)`, function () {
    it(`should return 404 for non-existent ${resource}`, async function () {
      await expectNotFound(supertest(app).delete(`${endpoint}/${missingId}`));
    });

    if (seed) {
      it(`should stage ${resource} deletion`, async function () {
        const ctx = context();
        const record = await seed(ctx);

        const response = await supertest(app)
          .delete(`${endpoint}/${record[pk]}`)
          .expect(200);

        expect(response.body.message).to.equal(deletedMessage);
        expect(response.body.success).to.be.true;
        await expectDeleteResponse?.(response.body);

        await expectStagedRowFor({ table, action: 'DELETE', pkColumn, id: record[pk] });
      });
    }
  });
};
