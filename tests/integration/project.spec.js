import _ from 'lodash';

import chai from 'chai';
const { expect } = chai;

import * as testFixtures from '../test-fixtures';

import { POLLING_INTERVAL } from '../../src/fullnode';
const TEST_WAIT_TIME = POLLING_INTERVAL * 2;

describe('Project Resource Integration Tests', function () {
  let homeOrgUid;

  beforeEach(async function () {
    await testFixtures.resetStagingTable();
    await testFixtures.createTestHomeOrg();
    homeOrgUid = await testFixtures.getHomeOrgId();
  });

  it.only('deletes a project end-to-end (with simulator)', async function () {
    /*
      Basic Idea for this test is that we are going to create a project and verify that
      the new project propagates through the data layer and into our db. Then we are going
      to delete the same project and make sure the delete command propagates through the datalayer 
      then gets removed from our db.
    */
    // create and commit the project to be deleted
    const newProjectPayload = await testFixtures.createNewProject();

    // Get the staging record we just created
    const stagingRecord = await testFixtures.getLastCreatedStagingRecord();

    // There is no original record when creating new projects
    expect(stagingRecord.diff.original).to.deep.equal({});

    // Change records are always in an array
    const changeRecord = _.head(stagingRecord.diff.change);

    // make sure the inferred data was set to the staging record
    expect(changeRecord.orgUid).to.equal(homeOrgUid);

    // make sure an warehouseProjectId was created
    // (this has to be done in the controller since we
    // send to the datalayer before it goes to our database,
    // so thres no oppertunity to have the id autoassigned)
    const warehouseProjectId = changeRecord.warehouseProjectId;
    expect(warehouseProjectId).to.be.ok;

    // Now push the staging table live
    await testFixtures.commitStagingRecords();
    await testFixtures.waitForDataLayerSync();

    // The staging table should be empty after committing
    expect(await testFixtures.getLastCreatedStagingRecord()).to.equal(
      undefined,
    );

    // Make sure the newly created project is in our Db
    await testFixtures.checkProjectRecordExists(warehouseProjectId);

    // Make sure the newly created project is in the mirrorDb
    await testFixtures.checkProjectMirrorRecordExists(warehouseProjectId);

    // Now time to delete the project
    await testFixtures.deleteProject(warehouseProjectId);

    // Get the staging record we just created
    const deleteStagingRecord =
      await testFixtures.getLastCreatedStagingRecord();

    // When deleting the change record should be empty, since the record is going away
    expect(deleteStagingRecord.diff.change).to.deep.equal({});

    // make sure all the data that was added during the creation
    // process in included in the record we are about to delete
    // Since some data is derived and not in the creation payload,
    // we need to test against the subset of the delete record
    // We alreay asserted existance of the derived data above
    console.log(deleteStagingRecord.diff.original);
    testFixtures.objectContainsSubSet(
      deleteStagingRecord.diff.original,
      newProjectPayload,
    );

    // Now push the staging table live
    await testFixtures.commitStagingRecords();
    await testFixtures.waitForDataLayerSync();

    // make sure the record is no longer in the db after the datalayer synced
    await testFixtures.checkProjectRecordDoesNotExist(warehouseProjectId);

    // Verify the record is no longer in the mirror db
    await testFixtures.checkProjectMirrorRecordDoesNotExist(warehouseProjectId);
  }).timeout(TEST_WAIT_TIME * 10);
});
