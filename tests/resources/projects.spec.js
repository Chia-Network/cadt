import { expect } from 'chai';
import _ from 'lodash';
import * as testFixtures from '../test-fixtures';
import sinon from 'sinon';
import datalayer from '../../src/datalayer';
import newProject from '../test-data/new-project.js';
import supertest from 'supertest';
import app from '../../src/server';
import { Organization } from '../../src/models/organizations/index.js';
import { pullPickListValues } from '../../src/utils/data-loaders';
import { Staging, Project } from '../../src/models/index.js';
import { uuid as uuidv4 } from 'uuidv4';
import { prepareDb, seedDb, sequelize } from '../../src/database';

const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

describe('Project Resource CRUD', function () {
  afterEach(function () {
    sinon.restore();
  });

  before(async function () {
    await pullPickListValues();
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 5000);
    });
    await prepareDb();
    await seedDb(sequelize);
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 5000);
    });
  });

  beforeEach(async function () {
    await supertest(app).get(`/v1/staging/clean`);
  });

  describe('GET projects', function () {
    describe('error states', function () {
      it('errors if there if there is no connection to the datalayer', async function () {
        sinon.stub(datalayer, 'dataLayerAvailable').resolves(false);
        const response = await supertest(app).get('/v1/projects');
        expect(response.statusCode).to.equal(400);

        expect(response.body.error).to.equal(
          'Can not establish connection to Chia Datalayer',
        );
      }).timeout(TEST_WAIT_TIME * 10);
    });

    describe('success states', function () {
      it('gets all the projects available', async function () {
        // no query params
        const projects = await testFixtures.getProjectByQuery();
        expect(projects.length).to.equal(10);
      }).timeout(TEST_WAIT_TIME * 10);

      it('gets all the projects filtered by orgUid', async function () {
        // ?orgUid=XXXX
        const projects = await testFixtures.getProjectByQuery({
          orgUid: 'a807e453-6524-49df-a32d-785e56cf560e',
        });
        expect(projects.length).to.equal(3);
      }).timeout(TEST_WAIT_TIME * 10);

      it('gets all the projects for a search term', async function () {
        // ?search=XXXX
        const projects = await testFixtures.getProjectByQuery({
          search: 'City of Arcata',
        });
        expect(projects.length).to.equal(1);
      }).timeout(TEST_WAIT_TIME * 10);

      it('gets all the projects for a search term filtered by orgUid', async function () {
        // ?orgUid=XXXX&search=XXXX
        const projects = await testFixtures.getProjectByQuery({
          orgUid: 'a807e453-6524-49df-a32d-785e56cf560e',
          search: 'City of Arcata',
        });

        expect(projects.length).to.equal(1);
      }).timeout(TEST_WAIT_TIME * 10);

      it('gets optional paginated results', async function () {
        // ?page=X&limit=10
        const projectsPage1 = await testFixtures.getProjectByQuery({
          page: 1,
          limit: 3,
        });
        expect(projectsPage1.data.length).to.equal(3);

        const projectsPage2 = await testFixtures.getProjectByQuery({
          page: 2,
          limit: 3,
        });

        expect(projectsPage2.data.length).to.equal(3);
        expect(projectsPage1.data).to.not.deep.equal(projectsPage2.data);

        const projectsLimit2 = await testFixtures.getProjectByQuery({
          page: 1,
          limit: 2,
        });
        expect(projectsLimit2.data.length).to.equal(2);
      }).timeout(TEST_WAIT_TIME * 10);

      it('finds a single result by warehouseProjectId', async function () {
        // ?warehouseProjectId=XXXX
        const projects = await testFixtures.getProjectByQuery({
          warehouseProjectId: '7f3a656e-d21c-409f-ae38-f97c89f0ae66',
        });

        // should get only 1 result
        expect(projects).to.be.a('object');
      }).timeout(TEST_WAIT_TIME * 10);
    });
  });

  describe('POST Projects - Create', function () {
    describe('error states', function () {
      it.skip('errors if no home organization exists', async function () {
        await Organization.destroy({
          where: {},
          truncate: true,
        });
        const response = await supertest(app)
          .post('/v1/projects')
          .send(newProject);

        expect(response.body).to.deep.equal(
          'No Home organization found, please create an organization to write data',
        );
        expect(response.statusCode).to.equal(400);

        await supertest(app).post(`/v1/organizations`).send({
          name: 'Test',
          icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
          prefix: 'test',
        });
      });

      it('errors if there is a current set of pending commits', async function () {
        const uuid = uuidv4();
        await Staging.create({
          uuid,
          commited: true,
          action: 'INSERT',
          table: Project.stagingTableName,
          data: JSON.stringify([{}]),
        });

        const response = await supertest(app)
          .post('/v1/projects')
          .send(newProject);

        expect(response.body.error).to.equal(
          'You currently have changes pending on the blockchain. Please wait for them to propagate before making more changes',
        );
        expect(response.statusCode).to.equal(400);
      }).timeout(TEST_WAIT_TIME * 10);

      it('errors if there if there is no connection to the datalayer', async function () {
        sinon.stub(datalayer, 'dataLayerAvailable').resolves(false);
        const response = await supertest(app)
          .post('/v1/projects')
          .send(newProject);

        expect(response.body.error).to.equal(
          'Can not establish connection to Chia Datalayer',
        );
        expect(response.statusCode).to.equal(400);
      }).timeout(TEST_WAIT_TIME * 10);
    });

    describe('success states', function () {
      it('creates a new project with no child tables', async function () {
        await Staging.destroy({
          where: {},
          truncate: true,
        });
        const projectData = _.clone(newProject);
        delete projectData.labels;
        delete projectData.issuances;
        delete projectData.coBenefits;
        delete projectData.relatedProjects;
        delete projectData.projectRatings;
        delete projectData.estimations;
        delete projectData.projectLocations;

        const response = await supertest(app)
          .post('/v1/projects')
          .send({
            ...projectData,
          });

        expect(response.body.message).to.equal('Project staged successfully');
        expect(response.statusCode).to.equal(200);
      }).timeout(TEST_WAIT_TIME * 10);

      it('creates a new project with all child tables', async function () {
        await Staging.destroy({
          where: {},
          truncate: true,
        });

        const response = await supertest(app)
          .post('/v1/projects')
          .send({
            ...newProject,
          });

        expect(response.body.message).to.equal('Project staged successfully');
        expect(response.statusCode).to.equal(200);
      }).timeout(TEST_WAIT_TIME * 10);
    });
  });

  describe('PUT Projects - Update', function () {
    describe('error states', function () {
      it('errors if no home organization exists', async function () {
        const responseCreate = await supertest(app)
          .get('/v1/projects')
          .send({
            ...newProject,
          });

        const warehouseProjectId = _.head(responseCreate.body);

        await Organization.destroy({
          where: {},
          truncate: true,
        });

        const response = await supertest(app)
          .put(`/v1/projects`)
          .send({
            ...newProject,
            warehouseProjectId: warehouseProjectId.toString(),
          });

        expect(response.body.message).to.deep.equal(
          'No Home organization found, please create an organization to write data',
        );

        expect(response.statusCode).to.equal(400);

        await supertest(app).post(`/v1/organizations`).send({
          name: 'Test',
          icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
          prefix: 'test',
        });
      }).timeout(TEST_WAIT_TIME * 10);

      it('errors if there is a current set of pending commits', function () {});

      it('errors if there if there is no connection to the datalayer', function () {});

      it('errors if the warehouseProjectId is not in the payload', function () {});

      it('errors if the warehouseProjectId is an existing record', function () {});

      it('errors if trying to update a child table that is not an existing record', function () {});

      it('errors if the orgUid of the project does not equal the home organization', function () {});
    });

    describe('success states', function () {
      it('updates a new project with no child tables', function () {});

      it('updates a new project with all child tables', function () {});
    });
  });

  describe('DELETE Projects - Delete', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});

      it('errors if there is a current set of pending commits', function () {});

      it('errors if there if there is no connection to the datalayer', function () {});

      it('errors if the warehouseProjectId is not in the payload', function () {});

      it('errors if the warehouseProjectId is an existing record', function () {});

      it('errors if the orgUid of the project does not equal the home organization', function () {});
    });

    describe('success states', function () {
      it('updates a new project with no child tables', function () {});

      it('updates a new project with all child tables', function () {});
    });
  });

  describe('websocket', function () {
    it('flags a change when projects are updated', function () {});
  });
});
