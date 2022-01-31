import _ from 'lodash';

import chai from 'chai';
import supertest from 'supertest';
const { expect } = chai;

import app from '../../src/server';
import { UnitMirror } from '../../src/models';

import * as testFixtures from '../test-fixtures';

import { POLLING_INTERVAL } from '../../src/fullnode';
const TEST_WAIT_TIME = POLLING_INTERVAL * 2;

describe('Unit Resource Integration Tests', function () {
  let homeOrgUid;

  beforeEach(async function () {
    await testFixtures.resetStagingTable();
    await testFixtures.createTestHomeOrg();
    homeOrgUid = await testFixtures.getHomeOrgId();
  });

  it('deletes a unit end-to-end (with simulator)', async function () {
    /*
      Basic Idea for this test is that we are going to create a unit and verify that
      the new unit propagates through the data layer and into our db. Then we are going
      to delete the same unit and make sure the delete command propagates through the datalayer 
      then gets removed from our db.
    */
    // create and commit the unit to be deleted
    const newUnitPayload = await testFixtures.createNewUnit();

    // Get the staging record we just created
    const stagingRecord = await testFixtures.getLastCreatedStagingRecord();

    // There is no original record when creating new units
    expect(stagingRecord.diff.original).to.deep.equal({});

    // Change records are always in an array
    const changeRecord = _.head(stagingRecord.diff.change);
    await testFixtures.childTablesIncludeOrgUid(changeRecord);
    await testFixtures.childTablesIncludePrimaryKey(changeRecord);

    // make sure the inferred data was set to the staging record
    expect(changeRecord.orgUid).to.equal(homeOrgUid);

    // make sure an warehouseUnitId was created
    // (this has to be done in the controller since we
    // send to the datalayer before it goes to our database,
    // so thres no oppertunity to have the id autoassigned)
    const warehouseUnitId = changeRecord.warehouseUnitId;
    expect(warehouseUnitId).to.be.ok;

    // Now push the staging table live
    await testFixtures.commitStagingRecords();
    await testFixtures.waitForDataLayerSync();

    // The staging table should be empty after committing
    expect(await testFixtures.getLastCreatedStagingRecord()).to.equal(
      undefined,
    );

    // Make sure the newly created unit is in our Db
    await testFixtures.checkUnitRecordExists(warehouseUnitId);

    // Make sure the newly created unit is in the mirrorDb
    await testFixtures.checkUnitMirrorRecordExists(warehouseUnitId);

    // Now time to delete the unit
    await testFixtures.deleteUnit(warehouseUnitId);

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
    testFixtures.objectContainsSubSet(
      deleteStagingRecord.diff.original,
      newUnitPayload,
    );

    // Now push the staging table live
    await testFixtures.commitStagingRecords();
    await testFixtures.waitForDataLayerSync();

    // make sure the record is no longer in the db after the datalayer synced
    await testFixtures.checkUnitRecordDoesNotExist(warehouseUnitId);
    await testFixtures.assertChildTablesDontExist(
      deleteStagingRecord.diff.original,
    );

    // Verify the record is no longer in the mirror db
    await testFixtures.checkUnitMirrorRecordDoesNotExist(warehouseUnitId);
  }).timeout(TEST_WAIT_TIME * 10);

  it('splits an existing unit end-to-end (with simulator)', async function () {
    // create and commit the unit to be deleted
    const createdUnitResult = await supertest(app).post('/v1/units').send({
      serialNumberBlock: 'AXJJFSLGHSHEJ9000-AXJJFSLGHSHEJ9010',
      serialNumberPattern: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
      countryJurisdictionOfOwner: 'USA',
      unitOwner: 'TEST_OWNER',
      unitType: 'removal',
      unitStatus: 'Held',
      vintageYear: 2020,
      correspondingAdjustmentDeclaration: 'Commited',
      correspondingAdjustmentStatus: 'Pending',
      inCountryJurisdictionOfOwner: 'Maryland',
      unitRegistryLink: 'https://test.link',
      marketplace: 'TEST_MARKETPLACE',
      marketplaceIdentifier: 'TEST_MARKETPLACE_IDENTIFIER',
      marketplaceLink: 'https://link.link',
      unitTags: 'TEST_TAGS, TEST_TAG2',
      unitStatusReason: 'TEST_REASON',
      // TODO: make initial project in beforeEach and assign id here
      // This will be validated appropriatly later
      projectLocationId: 'TEST_LOCATION_ID',
    });

    expect(createdUnitResult.body).to.deep.equal({
      message: 'Unit staged successfully',
    });

    expect(createdUnitResult.statusCode).to.equal(200);

    await supertest(app).get('/v1/staging');

    const createdCommitResult = await supertest(app).post('/v1/staging/commit');
    expect(createdCommitResult.statusCode).to.equal(200);
    expect(createdCommitResult.body).to.deep.equal({
      message: 'Staging Table committed to full node',
    });

    // The node simulator runs on an async process, we are importing
    // the WAIT_TIME constant from the simulator, padding it and waiting for the
    // appropriate amount of time for the simulator to finish its operations
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, TEST_WAIT_TIME);
    });

    // Get a unit to split
    const allUnitsResult = await supertest(app).get('/v1/units');

    const unitRecord = _.last(allUnitsResult.body);

    const warehouseUnitIdToSplit = unitRecord.warehouseUnitId;
    const newUnitOwner = '35f92331-c8d7-4e9e-a8d2-cd0a86cbb2cf';

    const payload = {
      warehouseUnitId: warehouseUnitIdToSplit,
      records: [
        {
          unitCount: unitRecord.unitCount - 1,
          unitOwner: newUnitOwner,
        },
        {
          unitCount: 1,
        },
      ],
    };

    const unitRes = await supertest(app).post('/v1/units/split').send(payload);

    expect(unitRes.body).to.deep.equal({
      message: 'Unit split successful',
    });
    expect(unitRes.statusCode).to.equal(200);

    // Get the staging record we just created
    const stagingRes = await supertest(app).get('/v1/staging');
    const stagingRecord = _.head(stagingRes.body);

    const originalRecord = stagingRecord.diff.original;

    // The orginal record should be the original unit before the split
    expect(originalRecord).to.deep.equal(unitRecord);

    // Check that the 2 split records have set up their data correctly
    const splitRecord1 = stagingRecord.diff.change[0];
    const splitRecord2 = stagingRecord.diff.change[1];

    // They should be getting their own ids
    expect(splitRecord1.warehouseUnitId).to.not.equal(warehouseUnitIdToSplit);
    expect(splitRecord2.warehouseUnitId).to.not.equal(warehouseUnitIdToSplit);

    // The first unitOwner is was reassigned,
    // the second we not reassigned and should match the original ownership
    expect(splitRecord1.unitOwner).to.equal(newUnitOwner);
    expect(splitRecord2.unitOwner).to.equal(unitRecord.unitOwner);

    expect(splitRecord1.unitCount).to.equal(9);
    expect(splitRecord2.unitCount).to.equal(1);

    // Expect the split unitscounts to add up to the original unit count
    expect(splitRecord1.unitCount + splitRecord2.unitCount).to.equal(
      originalRecord.unitCount,
    );

    // The rest of the fields should match the original for each split unit
    expect(splitRecord1.countryJurisdictionOfOwner).to.equal(
      unitRecord.countryJurisdictionOfOwner,
    );
    expect(splitRecord1.inCountryJurisdictionOfOwner).to.equal(
      unitRecord.inCountryJurisdictionOfOwner,
    );
    expect(splitRecord1.unitTags).to.equal(unitRecord.unitTags);

    expect(splitRecord2.countryJurisdictionOfOwner).to.equal(
      unitRecord.countryJurisdictionOfOwner,
    );
    expect(splitRecord2.inCountryJurisdictionOfOwner).to.equal(
      unitRecord.inCountryJurisdictionOfOwner,
    );
    expect(splitRecord2.unitTags).to.equal(unitRecord.unitTags);

    // Now push the staging table live
    const commitRes = await supertest(app).post('/v1/staging/commit');
    expect(stagingRes.statusCode).to.equal(200);
    expect(commitRes.body).to.deep.equal({
      message: 'Staging Table committed to full node',
    });

    // After commiting the true flag should be set to this staging record
    const stagingRes2 = await supertest(app).get('/v1/staging');
    expect(_.head(stagingRes2.body).commited).to.equal(true);

    // The node simulator runs on an async process, we are importing
    // the WAIT_TIME constant from the simulator, padding it and waiting for the
    // appropriate amount of time for the simulator to finish its operations
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, TEST_WAIT_TIME);
    });

    const warehouseRes = await supertest(app)
      .get(`/v1/units`)
      .query({ warehouseUnitId: splitRecord1.warehouseUnitId });

    const newRecord1 = warehouseRes.body;

    expect(newRecord1.warehouseUnitId).to.equal(splitRecord1.warehouseUnitId);
    expect(newRecord1.orgUid).to.equal(splitRecord1.orgUid);
    expect(newRecord1.unitOwner).to.equal(splitRecord1.unitOwner);
    expect(newRecord1.serialNumberBlock).to.equal(
      splitRecord1.serialNumberBlock,
    );
    expect(newRecord1.countryJuridictionOfOwner).to.equal(
      splitRecord1.countryJuridictionOfOwner,
    );
    expect(newRecord1.inCountryJuridictionOfOwner).to.equal(
      splitRecord1.inCountryJuridictionOfOwner,
    );

    // Make sure the newly created unit is in the mirrorDb
    const mirrorRecord1 = await UnitMirror.findByPk(
      splitRecord1.warehouseUnitId,
    );

    // filter out the fields we dont care about in this test, including the virtual fields
    expect(
      _.omit(mirrorRecord1.dataValues, [
        'createdAt',
        'updatedAt',
        'issuanceId',
      ]),
    ).to.deep.equal(
      _.omit(splitRecord1, [
        'labels', // mapped associated field
        'issuance', // mapped associated field
        'issuanceId',
        'unitBlockStart', // virtual field
        'unitBlockEnd', // virtual field
        'unitCount', // virtual field
        'createdAt', // meta field
        'updatedAt', // meta field
      ]),
    );

    const warehouse2Res = await supertest(app)
      .get(`/v1/units`)
      .query({ warehouseUnitId: splitRecord2.warehouseUnitId });

    const newRecord2 = warehouse2Res.body;

    expect(newRecord2.warehouseUnitId).to.equal(splitRecord2.warehouseUnitId);
    expect(newRecord2.orgUid).to.equal(splitRecord2.orgUid);
    expect(newRecord2.unitOwner).to.equal(splitRecord2.unitOwner);
    expect(newRecord1.serialNumberBlock).to.equal(
      splitRecord1.serialNumberBlock,
    );
    expect(newRecord2.countryJuridictionOfOwner).to.equal(
      splitRecord2.countryJuridictionOfOwner,
    );
    expect(newRecord2.inCountryJuridictionOfOwner).to.equal(
      splitRecord2.inCountryJuridictionOfOwner,
    );

    // Make sure the newly created unit is in the mirrorDb
    const mirrorRecord2 = await UnitMirror.findByPk(
      splitRecord2.warehouseUnitId,
    );

    // filter out the fields we dont care about in this test, including the virtual fields
    expect(
      _.omit(mirrorRecord2.dataValues, [
        'createdAt',
        'updatedAt',
        'issuanceId',
      ]),
    ).to.deep.equal(
      _.omit(splitRecord2, [
        'labels', // mapped associated field
        'issuance', // mapped associated field
        'issuanceId',
        'unitBlockStart', // virtual field
        'unitBlockEnd', // virtual field
        'unitCount', // virtual field
        'createdAt', // meta field
        'updatedAt', // meta field
      ]),
    );

    // make sure the original record was deleted
    const warehouse3Res = await supertest(app)
      .get(`/v1/units`)
      .query({ warehouseUnitId: warehouseUnitIdToSplit });
    expect(warehouse3Res.body).to.equal(null);

    // Make sure the staging table is cleaned up
    const stagingRes3 = await supertest(app).get('/v1/staging');

    // There should be no staging records left
    expect(stagingRes3.body.length).to.equal(0);
  }).timeout(TEST_WAIT_TIME * 10);

  it('creates a new unit end-to-end  (with simulator)', async function () {
    // 1. Create a new unit
    // 2. verify the unit is in the staging tables
    // 3. verify the inferred data has been added to the unit record
    // 3. commit the staging tables
    // 4. verify that the staging table has the committed flag set to true
    // 5. verify the unit was commited to the database
    // 6. verify the staging table was cleaned up

    // create and commit the unit to be deleted
    const newUnitPayload = await testFixtures.createNewUnit();

    // Get the staging record we just created
    const stagingRecord = await testFixtures.getLastCreatedStagingRecord();

    // There is no original when creating new units
    expect(stagingRecord.diff.original).to.deep.equal({});
    const changeRecord = _.head(stagingRecord.diff.change);

    await testFixtures.childTablesIncludeOrgUid(changeRecord);
    await testFixtures.childTablesIncludePrimaryKey(changeRecord);

    // make sure the inferred data was set to the staging record
    expect(changeRecord.orgUid).to.equal(homeOrgUid);
    const warehouseUnitId = changeRecord.warehouseUnitId;

    // Now push the staging table live
    await testFixtures.commitStagingRecords();

    // After commiting the true flag should be set to this staging record
    expect(
      (await testFixtures.getLastCreatedStagingRecord()).commited,
    ).to.equal(true);

    await testFixtures.waitForDataLayerSync();

    // Make sure the staging table is cleaned up
    expect(await testFixtures.getLastCreatedStagingRecord()).to.equal(
      undefined,
    );

    const newUnit = await testFixtures.getUnit(warehouseUnitId);

    testFixtures.objectContainsSubSet(newUnit, newUnitPayload);
    await testFixtures.childTablesIncludeOrgUid(newUnit);
    await testFixtures.childTablesIncludePrimaryKey(newUnit);

    // Make sure the newly created unit is in the mirrorDb
    await testFixtures.checkUnitRecordExists(warehouseUnitId);
  }).timeout(TEST_WAIT_TIME * 10);
});
