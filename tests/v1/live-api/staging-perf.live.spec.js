/**
 * V1 staging GET performance + datalayer commit regression test.
 *
 * For POST / PUT / DELETE phases this:
 *   - stages a configurable batch (default 100 projects),
 *   - times a single GET /v1/staging (unpaginated) before committing,
 *   - asserts status 200, expected staged row count, and response time
 *     under the configured budget,
 *   - commits + waits for the existing datalayer submission path to
 *     succeed (no tight SLA on the commit path itself).
 *
 * PUT and DELETE are the phases that exercise the batched-diff hydration
 * path (Project/Unit/Issuance findAll IN) the staging.model.js fix
 * targets. POST short-circuits on INSERT and is kept as a baseline smoke
 * on the unpaginated GET shape + commit round-trip.
 *
 * Tunables (env overrides for tuning after live runs):
 *   STAGING_PERF_V1_ROW_COUNT   default 100
 *   STAGING_PERF_V1_BUDGET_MS   default 3000
 *   STAGING_PERF_V1_COMMIT_TIMEOUT_MS default 1_200_000 (20 min per phase)
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

const ROW_COUNT = parseIntEnv('STAGING_PERF_V1_ROW_COUNT', 100);
const BUDGET_MS = parseIntEnv('STAGING_PERF_V1_BUDGET_MS', 3000);
const COMMIT_TIMEOUT_MS = parseIntEnv('STAGING_PERF_V1_COMMIT_TIMEOUT_MS', 1_200_000);

// Overall spec timeout: 3 commit phases plus staging + wait padding.
const SPEC_TIMEOUT_MS = COMMIT_TIMEOUT_MS * 3 + 600_000;

/**
 * Time a GET /v1/staging call and assert budget + row count.
 * Uses the unpaginated path (no `page` query) because that is the path
 * the batched-diff fix targets.
 */
async function measureStagingGet(request, expectedCount, phaseLabel) {
  const startedAt = Date.now();
  const response = await request.get('/v1/staging');
  const elapsedMs = Date.now() - startedAt;

  const records = Array.isArray(response.body)
    ? response.body
    : (response.body?.data || []);

  console.log(
    `[staging-perf][v1][${phaseLabel}] GET /v1/staging: ` +
    `status=${response.status} rows=${records.length} ` +
    `elapsedMs=${elapsedMs} budgetMs=${BUDGET_MS}`,
  );

  expect(response.status, `${phaseLabel} GET /v1/staging status`).to.equal(200);
  expect(records.length, `${phaseLabel} staged row count`).to.equal(expectedCount);
  expect(elapsedMs, `${phaseLabel} GET /v1/staging elapsed`).to.be.at.most(BUDGET_MS);

  return { elapsedMs, records };
}

describe('V1 Staging GET Performance (Live API)', function () {
  this.timeout(SPEC_TIMEOUT_MS);

  let request;
  const stagedProjects = [];
  let committedProjectIds = [];

  before(async function () {
    console.log(
      `[staging-perf][v1] config: ROW_COUNT=${ROW_COUNT} BUDGET_MS=${BUDGET_MS} ` +
      `COMMIT_TIMEOUT_MS=${COMMIT_TIMEOUT_MS}`,
    );

    request = await getLiveApiRequest();
    const homeOrgId = await getHomeOrgId(request);
    console.log(`[staging-perf][v1] home org: ${homeOrgId}`);

    await clearStagingTable(request);
  });

  it(`POST phase: stages ${ROW_COUNT} projects, GET /v1/staging under budget, commits`, async function () {
    for (let i = 0; i < ROW_COUNT; i += 1) {
      const data = generateProject();
      const { id, response } = await makePostRequest(request, '/v1/projects', data);
      expect(response.success, `POST /v1/projects #${i + 1}`).to.be.true;
      expect(id, `POST /v1/projects #${i + 1} returned id`).to.exist;
      stagedProjects.push({ id, data });
    }

    await measureStagingGet(request, ROW_COUNT, 'POST');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request, COMMIT_TIMEOUT_MS);
    await waitForStagingEmpty(request, COMMIT_TIMEOUT_MS);

    // V1 uses warehouseProjectId == uuid from POST response.
    const waitRecords = stagedProjects.map(({ id }) => ({ type: 'project', id }));
    await waitForBatchToAppear(request, waitRecords, COMMIT_TIMEOUT_MS);

    committedProjectIds = stagedProjects.map(({ id }) => id);
  });

  it(`PUT phase: updates ${ROW_COUNT} projects, GET /v1/staging under budget, commits`, async function () {
    expect(committedProjectIds.length, 'have committed projects from POST phase').to.equal(ROW_COUNT);

    for (let i = 0; i < committedProjectIds.length; i += 1) {
      const id = committedProjectIds[i];
      // V1 PUT requires a full project payload; regenerate with the same shape
      // and add a perf-tagged field so each update is a real diff.
      const updated = {
        ...generateProject(),
        projectName: `Perf Update ${i + 1} ${Date.now()}`,
      };
      const body = await makePutRequest(request, '/v1/projects', id, updated);
      expect(body?.success, `PUT /v1/projects #${i + 1}`).to.equal(true);
    }

    await measureStagingGet(request, ROW_COUNT, 'PUT');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request, COMMIT_TIMEOUT_MS);
    await waitForStagingEmpty(request, COMMIT_TIMEOUT_MS);
  });

  it(`DELETE phase: deletes ${ROW_COUNT} projects, GET /v1/staging under budget, commits`, async function () {
    expect(committedProjectIds.length, 'have committed projects from POST phase').to.equal(ROW_COUNT);

    for (let i = 0; i < committedProjectIds.length; i += 1) {
      const id = committedProjectIds[i];
      const body = await makeDeleteRequest(request, '/v1/projects', id);
      expect(body?.success, `DELETE /v1/projects #${i + 1}`).to.equal(true);
    }

    await measureStagingGet(request, ROW_COUNT, 'DELETE');

    await commitStagedRecords(request, [], true);
    await waitForPendingCommits(request, COMMIT_TIMEOUT_MS);
    await waitForStagingEmpty(request, COMMIT_TIMEOUT_MS);
  });
});
