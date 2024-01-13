import supertest from 'supertest';
import app from '../../src/server';

export const createTestHomeOrg = async () => {
  const response = await supertest(app).post(`/v1/organizations`).send({
    name: 'My Org',
    icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
  });

  console.log('Creating home org', response.body);

  return response;
};

export const getHomeOrgId = async () => {
  const organizationResults = await supertest(app).get('/v1/organizations');
  return Object.keys(organizationResults.body).find(
    (key) => organizationResults.body[key].isHome,
  );
};
