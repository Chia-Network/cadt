describe('Staging Resource CRUD', function () {
  describe('GET - Find all Staging Records', function () {
    it('shows all commited and none committed staging records', function () {});
    it('generates a diff object for the change', function () {});
  });

  describe('POST - Commit Records to datalayer', function () {
    it('Sends the staging table to the datalayer', function () {});
    it('Sets the committed flag to true when sent to the datalayer', function () {});
    it('Staging record is removed when Insert records propagate through the datalayer', function () {});
    it('Staging record is removed when Update records propagate through the datalayer', function () {});
    it('Staging record is removed when Delete records propagate through the datalayer', function () {});
    it('can commit just the project staging records optionally', function () {});
    it('can commit just the unit staging records optionally', function () {});
  });

  describe('DELETE - Delete a single staging record', function () {
    it('Removes the staging record from the staging table', function () {});
  });

  describe('DELETE - Clears the staging table', function () {
    it('Clears the staging table', function () {});
  });
});
