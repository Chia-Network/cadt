import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';

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
  }

  return response;
};

export const getHomeOrgId = async () => {
  const organizationResults = await supertest(app).get('/v1/organizations');
  return Object.keys(organizationResults.body).find(
    (key) => organizationResults.body[key].isHome,
  );
};
