import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { getOrgLockStatus } from '../../src/utils/org-operation-lock.js';

/**
 * Wait for the global org-operation lock to be released.
 * The org row is written before createHomeOrganization finishes and the lock
 * is only released once it does, so polling for the row alone can return while
 * a creation is still in flight. Any org endpoint hit in that window answers
 * 409, which leaks into whichever spec runs next.
 * Against the simulator a creation completes in well under a second, so a
 * lock still held at the deadline means something is stuck; throw rather than
 * let the caller proceed against half-created state.
 * @param {number} maxAttempts - Maximum number of polling attempts
 * @param {number} interval - Time between polling attempts in ms
 */
const waitForOrgLockRelease = async (maxAttempts = 240, interval = 250) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!getOrgLockStatus()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  const status = getOrgLockStatus();
  throw new Error(
    `Org operation lock still held after ${(maxAttempts * interval) / 1000}s: ` +
      `${status?.operation} (${status?.status})`,
  );
};

/**
 * Wait for organization creation to complete by polling the database
 * This is necessary because v1 org creation is now asynchronous
 * @param {number} maxAttempts - Maximum number of polling attempts (default: 20)
 * @param {number} interval - Time between polling attempts in ms (default: 500)
 * @returns {Promise<Object|null>} The created organization or null if timeout
 */
const waitForOrgToExist = async (maxAttempts = 20, interval = 500) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const org = await Organization.findOne({ where: { isHome: true } });
    if (org) {
      console.log(`Home org found after ${attempt} attempts`);
      return org;
    }
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  console.log('Home org not found after max attempts');
  return null;
};

export const createTestHomeOrg = async () => {
  // An earlier spec's creation may still be running. Its PENDING placeholder
  // row is flagged isHome, so the existence check below would otherwise match
  // a half-created org, and a POST issued now would be rejected with a 409.
  await waitForOrgLockRelease();

  // Check if org already exists
  const existingOrg = await Organization.findOne({ where: { isHome: true } });
  if (existingOrg) {
    console.log('Home org already exists, skipping creation');
    return { body: { message: 'Home org already exists', orgUid: existingOrg.orgUid } };
  }

  const response = await supertest(app).post(`/v1/organizations`).send({
    name: 'My Org',
    icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
  });

  console.log('Creating home org', response.body);

  // Wait for org to actually be created (v1 creation is now async)
  if (response.body.success) {
    await waitForOrgToExist();
    await waitForOrgLockRelease();
  }

  return response;
};

export const getHomeOrgId = async () => {
  const organizationResults = await supertest(app).get('/v1/organizations');
  return Object.keys(organizationResults.body).find(
    (key) => organizationResults.body[key].isHome,
  );
};
