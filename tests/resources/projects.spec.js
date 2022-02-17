import chai from 'chai';
import * as testFixtures from '../test-fixtures';
import sinon from 'sinon';
import datalayer from '../../src/datalayer';
const { expect } = chai;

import supertest from 'supertest';
import app from '../../src/server';

describe('Project Resource CRUD', function () {
  afterEach(function () {
    sinon.restore();
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
      });
    });

    describe('success states', function () {
      it('gets all the projects available', async function () {
        // no query params
        const projects = await testFixtures.getProjectByQuery();
        expect(projects.length).to.equal(11);
      });

      it('gets all the projects filtered by orgUid', async function () {
        // ?orgUid=XXXX
        const projects = await testFixtures.getProjectByQuery({
          orgUid: 'a807e453-6524-49df-a32d-785e56cf560e',
        });
        expect(projects.length).to.equal(3);
      });

      it('gets all the projects for a search term', async function () {
        // ?search=XXXX
        const projects = await testFixtures.getProjectByQuery({
          search: 'City of Arcata',
        });
        expect(projects.length).to.equal(1);
      });

      it('gets all the projects for a search term filtered by orgUid', async function () {
        // ?orgUid=XXXX&search=XXXX
        const projects = await testFixtures.getProjectByQuery({
          orgUid: 'a807e453-6524-49df-a32d-785e56cf560e',
          search: 'City of Arcata',
        });

        expect(projects.length).to.equal(1);
      });

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
      });

      it('finds a single result by warehouseProjectId', async function () {
        // ?warehouseProjectId=XXXX
        const projects = await testFixtures.getProjectByQuery({
          warehouseProjectId: '7f3a656e-d21c-409f-ae38-f97c89f0ae66',
        });

        // should get only 1 result
        expect(projects).to.be.a('object');
      });
    });
  });

  describe('POST Projects - Create', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
    });

    describe('success states', function () {
      it('creates a new project with no child tables', function () {});
      it('creates a new project with all child tables', function () {});
    });
  });

  describe('PUT Projects - Update', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
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
