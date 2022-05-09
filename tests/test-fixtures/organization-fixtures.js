import supertest from 'supertest';
import app from '../../src/server';

export const createTestHomeOrg = async () => {
  const response = await supertest(app).post(`/v1/organizations`).send({
    name: 'My Org',
    icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
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
