//import chai from 'chai';
///import chaiHttp from 'chai-http';
//import app from './../../src/server';

describe('Units Resource CRUD', function () {
  describe('GET Units', function () {
    describe('error states', function () {
      it('errors if there if there is no connection to the datalayer', function () {});
    });

    describe('success states', function () {
      it('gets all the units available', function () {
        // no query params
      });
      it('gets all the units filtered by orgUid', function () {
        // ?orgUid=XXXX
      });
      it('gets all the units for a search term', function () {
        // ?search=XXXX
      });
      it('gets all the units for a search term filtered by orgUid', function () {
        // ?orgUid=XXXX&search=XXXX
      });
      it('gets optional paginated results', function () {
        // ?page=X&limit=10
      });
      it('finds a single result by warehouseUnitId', function () {
        // ?warehouseUnitId=XXXX
      });
    });
  });

  describe('POST Units - Create', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
    });

    describe('success states', function () {
      it('creates a new unit with no child tables', function () {});
      it('creates a new unit with all child tables', function () {});
    });
  });

  describe('PUT Units - Update', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
      it('errors if the warehouseUnitId is not in the payload', function () {});
      it('errors if the warehouseUnitId is an existing record', function () {});
      it('errors if trying to update a child table that is not an existing record', function () {});
      it('errors if the orgUid of the unit does not equal the home organization', function () {});
    });

    describe('success states', function () {
      it('updates a new unit with no child tables', function () {});
      it('updates a new unit with all child tables', function () {});
    });
  });

  describe('DELETE Units - Delete', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
      it('errors if the warehouseUnitId is not in the payload', function () {});
      it('errors if the warehouseUnitId is an existing record', function () {});
      it('errors if the orgUid of the unit does not equal the home organization', function () {});
    });

    describe('success states', function () {
      it('updates a new unit with no child tables', function () {});
      it('updates a new unit with all child tables', function () {});
    });
  });

  describe('PUT - Split Units', function () {
    describe('error states', function () {
      it('errors if no home organization exists', function () {});
      it('errors if there is a current set of pending commits', function () {});
      it('errors if there if there is no connection to the datalayer', function () {});
      it('errors if the orgUid of the unit does not equal the home organization', function () {});
      it('errors if the unit split does not add up correctly', function () {});
    });

    describe('success states', function () {
      it('properly splits the unit', function () {});
    });
  });
});
