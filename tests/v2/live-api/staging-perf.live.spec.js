/**
 * V2 staging GET performance + datalayer commit regression test.
 *
 * Mirrors tests/v1/live-api/staging-perf.live.spec.js against the V2 API.
 * For POST / PUT / DELETE phases this:
 *   - stages a configurable batch (default 100 projects),
 *   - times a single GET /v2/staging with limit >= ROW_COUNT so the whole
 *     batch lands in one request (single-request SLA, not a paginated
 *     browse) before committing,
 *   - asserts status 200, expected staged row count, and response time
 *     under the configured budget,
 *   - commits + waits for the existing datalayer submission path to
 *     succeed (no tight SLA on the commit path itself).
 *
 * V2 staging is served by src/controllers/v2/staging-v2.controller.js,
 * which is a separate code path from the V1 staging controller. This
 * spec is a baseline SLA for that V2 path independent of any batched-
 * diff work on V1; it will be useful as a regression guard once the
 * equivalent batching lands on V2.
 *
 * Tunables (env overrides for tuning after live runs):
 *   STAGING_PERF_V2_ROW_COUNT   default 100
 *   STAGING_PERF_V2_BUDGET_MS   default 2000
 *   STAGING_PERF_V2_COMMIT_TIMEOUT_MS default 1_200_000 (20 min per phase)
 */

import { expect } from 'chai';
import {
  getLiveApiRequest,
  getHomeOrgId,
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
  waitForBatchToAppear,
  clearStagingTable,
} from './helpers/live-api-helpers.js';
import {
  makePostRequest,
  makePutRequest,
  makeDeleteRequest,
} from './helpers/api-request-helpers.js';
import { generateProject } from './data/test-data-generators.js';

const parseIntEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  // Zero would collapse ROW_COUNT / BUDGET_MS / COMMIT_TIMEOUT_MS to no-ops
  // or always-fail, so reject <= 0 explicitly.
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}=${raw}; expected positive integer`);
  }
  return parsed;
};

// V2 paginationSchema caps `limit` at 1000 (src/validations/v2/pagination-v2.validations.js).
// Staying at or below that keeps the single-request SLA valid; bumping ROW_COUNT higher
// would require paging across multiple GETs and rethinking the budget.
const MAX_STAGING_PAGE_LIMIT = 1000;

const ROW_COUNT = parseIntEnv('STAGING_PERF_V2_ROW_COUNT', 100);
if (ROW_COUNT > MAX_STAGING_PAGE_LIMIT) {
  throw new Error(
    `STAGING_PERF_V2_ROW_COUNT=${ROW_COUNT} exceeds the V2 pagination limit ` +
    `(${MAX_STAGING_PAGE_LIMIT}); the single-GET SLA would return a clamped page.`,
  );
}
const BUDGET_MS = parseIntEnv('STAGING_PERF_V2_BUDGET_MS', 2000);
const COMMIT_TIMEOUT_MS = parseIntEnv('STAGING_PERF_V2_COMMIT_TIMEOUT_MS', 1_200_000);

const STAGING_PAGE_LIMIT = MAX_STAGING_PAGE_LIMIT;

const SPEC_TIMEOUT_MS = COMMIT_TIMEOUT_MS * 3 + 600_000;

async function measureStagingGet(request, expectedCount, phaseLabel) {
  const startedAt = Date.now();
  const response = await request
    .get('/v2/staging')
    .query({ page: 1, limit: STAGING_PAGE_LIMIT });
  const elapsedMs = Date.now() - startedAt;

  const records = Array.isArray(response.body)
    ? response.body
    : (response.body?.data || []);

  console.log(
    `[staging-perf][v2][${phaseLabel}] GET /v2/staging?page=1&limit=${STAGING_PAGE_LIMIT}: ` +
    `status=${response.status} rows=${records.length} ` +
    `elapsedMs=${elapsedMs} budgetMs=${BUDGET_MS}`,
  );

  expect(response.status, `${phaseLabel} GET /v2/staging status`).to.equal(200);
  expect(records.length, `${phaseLabel} staged row count`).to.equal(expectedCount);
  expect(elapsedMs, `${phaseLabel} GET /v2/staging elapsed`).to.be.at.most(BUDGET_MS);

  return { elapsedMs, records };
}

describe('V2 Staging GET Performance (Live API)', function () {
  this.timeout(SPEC_TIMEOUT_MS);

  let request;
  const stagedProjects = [];
  let committedProjectIds = [];

  before(async function () {
    console.log(
      `[staging-perf][v2] config: ROW_COUNT=${ROW_COUNT} BUDGET_MS=${BUDGET_MS} ` +
      `COMMIT_TIMEOUT_MS=${COMMIT_TIMEOUT_MS} STAGING_PAGE_LIMIT=${STAGING_PAGE_LIMIT}`,
    );

    request = await getLiveApiRequest({ apiVersion: 'v2' });
    const homeOrgId = await getHomeOrgId(request);
    console.log(`[staging-perf][v2] home org: ${homeOrgId}`);

    await clearStagingTable(request);
  });

  it(`POST phase: stages ${ROW_COUNT} projects, GET /v2/staging under budget, commits`, async function () {
    for (let i = 0; i < ROW_COUNT; i += 1) {
      const data = generateProject();
      const { id, response } = await makePostRequest(request, '/v2/project', data);
      expect(response.success, `POST /v2/project #${i + 1}`).to.be.true;
      expect(id, `POST /v2/project #${i + 1} returned id`).to.exist;
      stagedProjects.push({ id, data });
    }

    await measureStagingGet(request, ROW_COUNT, 'POST');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request, COMMIT_TIMEOUT_MS);
    await waitForStagingEmpty(request, COMMIT_TIMEOUT_MS);

    const waitRecords = stagedProjects.map(({ id }) => ({ type: 'project', id }));
    await waitForBatchToAppear(request, waitRecords, COMMIT_TIMEOUT_MS);

    committedProjectIds = stagedProjects.map(({ id }) => id);
  });

  it(`PUT phase: updates ${ROW_COUNT} projects, GET /v2/staging under budget, commits`, async function () {
    expect(committedProjectIds.length, 'have committed projects from POST phase').to.equal(ROW_COUNT);

    for (let i = 0; i < committedProjectIds.length; i += 1) {
      const id = committedProjectIds[i];
      // V2 PUT goes to /v2/project/:id with a full replacement body.
      const updated = {
        ...generateProject(),
        projectName: `Perf Update ${i + 1} ${Date.now()}`,
      };
      const body = await makePutRequest(request, '/v2/project', id, updated);
      expect(body?.success, `PUT /v2/project/${id}`).to.equal(true);
    }

    await measureStagingGet(request, ROW_COUNT, 'PUT');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request, COMMIT_TIMEOUT_MS);
    await waitForStagingEmpty(request, COMMIT_TIMEOUT_MS);
  });

  it(`DELETE phase: deletes ${ROW_COUNT} projects, GET /v2/staging under budget, commits`, async function () {
    expect(committedProjectIds.length, 'have committed projects from POST phase').to.equal(ROW_COUNT);

    for (let i = 0; i < committedProjectIds.length; i += 1) {
      const id = committedProjectIds[i];
      const body = await makeDeleteRequest(request, '/v2/project', id);
      expect(body?.success, `DELETE /v2/project/${id}`).to.equal(true);
    }

    await measureStagingGet(request, ROW_COUNT, 'DELETE');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request, COMMIT_TIMEOUT_MS);
    await waitForStagingEmpty(request, COMMIT_TIMEOUT_MS);
  });
});
