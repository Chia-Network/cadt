import chai from 'chai';
import { get } from '../utils/request-utils';

const { expect } = chai;

describe('Project Resource CRUD', () => {
  it('gets all the projects available', async () => {
    const { body, status } = await get('/v1/projects');
    expect(status).to.equal(200);
  });
});
