// import chai from 'chai';
//import supertest from 'supertest';
//import app from '../../src/server';

// const { expect } = chai;

describe('Project Resource CRUD', function () {
  describe('GET projects', function () {
    describe('error states', function () {
      it('errors if there if there is no connection to the datalayer', function () {});
    });

    describe('success states', function () {
      it('gets all the projects available', function () {
        // no query params
      });
      it('gets all the projects filtered by orgUid', function () {
        // ?orgUid=XXXX
      });
      it('gets all the projects for a search term', function () {
        // ?search=XXXX
      });
      it('gets all the projects for a search term filtered by orgUid', function () {
        // ?orgUid=XXXX&search=XXXX
      });
      it('gets optional paginated results', function () {
        // ?page=X&limit=10
      });
      it('finds a single result by warehouseProjectId', function () {
        // ?warehouseProjectId=XXXX
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
