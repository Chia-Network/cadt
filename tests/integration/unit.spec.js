import _ from 'lodash';

import chai from 'chai';
import supertest from 'supertest';
import app from '../../src/server';

import { UnitMirror } from '../../src/models';

const { expect } = chai;

import { POLLING_INTERVAL } from '../../src/fullnode';

const TEST_WAIT_TIME = POLLING_INTERVAL * 2;

describe('Create Unit Integration', function () {
  beforeEach(async function () {
    await supertest(app).get(`/v1/staging/clean`);
    await supertest(app).post(`/v1/organizations`).send({
      name: 'My Org',
      icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
    });
  });

  it('deletes a unit end-to-end (with simulator)', async function () {
    // create and commit the unit to be deleted
    const payload = {
      serialNumberBlock: 'AXJJFSLGHSHEJ9000-AXJJFSLGHSHEJ9010',
      serialNumberPattern: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
      countryJurisdictionOfOwner: 'USA',
      unitType: 'removal',
      unitIdentifier: 'XYZ',
      unitStatus: 'Held',
      correspondingAdjustmentDeclaration: 'Commited',
      correspondingAdjustmentStatus: 'Pending',
      inCountryJurisdictionOfOwner: 'Maryland',
      unitsIssuanceLocation: 'TEST_LOCATION',
      unitRegistryLink: 'https://test.link',
      tokenIssuanceHash: '0x7777',
    };
    const unitRes = await supertest(app).post('/v1/units').send(payload);

    expect(unitRes.statusCode).to.equal(200);
    expect(unitRes.body).to.deep.equal({
      message: 'Unit staged successfully',
    });

    // Get the organizations so we can check the right org was set
    const organizationResults = await supertest(app).get('/v1/organizations');
    const orgUid = Object.keys(organizationResults.body).find(
      (key) => organizationResults.body[key].isHome,
    );

    // Get the staging record we just created
    const stagingRes = await supertest(app).get('/v1/staging');
    const stagingRecord = _.head(stagingRes.body);

    // There is no original when creating new units
    expect(stagingRecord.diff.original).to.deep.equal({});

    const changeRecord = _.head(stagingRecord.diff.change);

    // make sure the inferred data was set to the staging record
    expect(changeRecord.orgUid).to.equal(orgUid);

    const warehouseUnitId = changeRecord.warehouseUnitId;

    // Now push the staging table live
    const commitRes = await supertest(app).post('/v1/staging/commit');
    expect(commitRes.statusCode).to.equal(200);
    expect(commitRes.body).to.deep.equal({
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

    // Get the staging record we just created
    const stagingRes2 = await supertest(app).get('/v1/staging');
    expect(stagingRes2.body).to.deep.equal([]);

    // Make sure the newly created unit is in the mirrorDb
    let mirrorRecord = await UnitMirror.findByPk(warehouseUnitId);

    expect(mirrorRecord).to.be.ok;

    // Now time to delete the unit
    const deleteRes = await supertest(app)
      .delete('/v1/units')
      .send({ warehouseUnitId });

    expect(deleteRes.statusCode).to.equal(200);
    expect(deleteRes.body).to.deep.equal({
      message: 'Unit deleted successfully',
    });

    // Get the staging record we just created
    const deleteStagingRes = await supertest(app).get('/v1/staging');
    const deleteStagingRecord = _.head(deleteStagingRes.body);

    // There is no original when creating new units
    expect(deleteStagingRecord.diff.change).to.deep.equal({});

    const deleteOriginalRecord = deleteStagingRecord.diff.original;

    expect(
      _.pick(deleteOriginalRecord, [...Object.keys(payload)]),
    ).to.deep.equal(payload);

    // Now push the staging table live
    const commitRes3 = await supertest(app).post('/v1/staging/commit');
    expect(commitRes3.statusCode).to.equal(200);
    expect(commitRes3.body).to.deep.equal({
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

    // Now check if the unit is still in the DB
    const getDeletedRecordResult = await supertest(app)
      .get('/v1/units')
      .query({ warehouseUnitId });

    expect(getDeletedRecordResult.statusCode).to.equal(200);
    expect(getDeletedRecordResult.body).to.equal(null);

    // Verify the record is no longer in the mirror db
    mirrorRecord = await UnitMirror.findByPk(warehouseUnitId);
    expect(mirrorRecord).to.equal(null);
  }).timeout(TEST_WAIT_TIME * 10);

  it('splits an existing unit end-to-end (with simulator)', async function () {
    // create and commit the unit to be deleted
    const createdUnitResult = await supertest(app).post('/v1/units').send({
      serialNumberBlock: 'AXJJFSLGHSHEJ9000-AXJJFSLGHSHEJ9010',
      serialNumberPattern: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
      countryJurisdictionOfOwner: 'USA',
      unitOwner: 'TEST_OWNER',
      unitType: 'removal',
      unitIdentifier: 'XYZ',
      unitStatus: 'Held',
      correspondingAdjustmentDeclaration: 'Commited',
      correspondingAdjustmentStatus: 'Pending',
      inCountryJurisdictionOfOwner: 'Maryland',
      unitsIssuanceLocation: 'TEST_LOCATION',
      unitRegistryLink: 'https://test.link',
      tokenIssuanceHash: '0x7777',
      intendedBuyerOrgUid: 'TEST_OWNER',
      marketplace: 'TEST_MARKETPLACE',
      marketplaceIdentifier: 'TEST_MARKETPLACE_IDENTIFIER',
      tags: 'TEST_TAGS, TEST_TAG2',
      unitStatusReason: 'TEST_REASON',
      unitTransactionType: 'TEST_TYPE',
      unitMarketplaceLink: 'TEST_MARKETPLACE_LINK',
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
    expect(splitRecord1.intendedBuyerOrgUid).to.equal(
      unitRecord.intendedBuyerOrgUid,
    );
    expect(splitRecord1.tags).to.equal(unitRecord.tags);
    expect(splitRecord1.tokenIssuanceHash).to.equal(
      unitRecord.tokenIssuanceHash,
    );

    expect(splitRecord2.countryJurisdictionOfOwner).to.equal(
      unitRecord.countryJurisdictionOfOwner,
    );
    expect(splitRecord2.inCountryJurisdictionOfOwner).to.equal(
      unitRecord.inCountryJurisdictionOfOwner,
    );
    expect(splitRecord2.intendedBuyerOrgUid).to.equal(
      unitRecord.intendedBuyerOrgUid,
    );
    expect(splitRecord2.tags).to.equal(unitRecord.tags);
    expect(splitRecord2.tokenIssuanceHash).to.equal(
      unitRecord.tokenIssuanceHash,
    );

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
    expect(newRecord1.tokenIssuanceHash).to.equal(
      splitRecord1.tokenIssuanceHash,
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
        'qualifications', // mapped associated field
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
    expect(newRecord2.tokenIssuanceHash).to.equal(
      splitRecord2.tokenIssuanceHash,
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
        'qualifications', // mapped associated field
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

    const payload = {
      serialNumberBlock: 'AXJJFSLGHSHEJ9000-AXJJFSLGHSHEJ9010',
      serialNumberPattern: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
      countryJurisdictionOfOwner: 'USA',
      unitType: 'removal',
      unitIdentifier: 'XYZ',
      unitStatus: 'Held',
      correspondingAdjustmentDeclaration: 'Commited',
      correspondingAdjustmentStatus: 'Pending',
      inCountryJurisdictionOfOwner: 'Maryland',
      unitsIssuanceLocation: 'TEST_LOCATION',
      unitRegistryLink: 'https://test.link',
      tokenIssuanceHash: '0x7777',
    };
    const unitRes = await supertest(app).post('/v1/units').send(payload);

    expect(unitRes.statusCode).to.equal(200);
    expect(unitRes.body).to.deep.equal({
      message: 'Unit staged successfully',
    });

    // Get the organizations so we can check the right org was set
    const organizationResults = await supertest(app).get('/v1/organizations');
    const orgUid = Object.keys(organizationResults.body).find(
      (key) => organizationResults.body[key].isHome,
    );

    // Get the staging record we just created
    const stagingRes = await supertest(app).get('/v1/staging');
    const stagingRecord = _.head(stagingRes.body);

    // There is no original when creating new units
    expect(stagingRecord.diff.original).to.deep.equal({});

    const changeRecord = _.head(stagingRecord.diff.change);

    // make sure the inferred data was set to the staging record
    expect(changeRecord.orgUid).to.equal(orgUid);

    const warehouseUnitId = changeRecord.warehouseUnitId;

    expect(stagingRes.statusCode).to.equal(200);

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

    // Make sure the staging table is cleaned up
    const stagingRes3 = await supertest(app).get('/v1/staging');

    // There should be no staging records left
    expect(stagingRes3.body.length).to.equal(0);

    const warehouseRes = await supertest(app)
      .get(`/v1/units`)
      .query({ warehouseUnitId });

    const newRecord = warehouseRes.body;

    expect(newRecord.warehouseUnitId).to.equal(warehouseUnitId);
    expect(newRecord.orgUid).to.equal(orgUid);
    expect(newRecord.serialNumberBlock).to.equal(payload.serialNumberBlock);
    expect(newRecord.countryJuridictionOfOwner).to.equal(
      payload.countryJuridictionOfOwner,
    );
    expect(newRecord.inCountryJuridictionOfOwner).to.equal(
      payload.inCountryJuridictionOfOwner,
    );
    expect(newRecord.tokenIssuanceHash).to.equal(payload.tokenIssuanceHash);

    // Make sure the newly created unit is in the mirrorDb
    const mirrorRecord = await UnitMirror.findByPk(newRecord.warehouseUnitId);

    // filter out the fields we dont care about in this test, including the virtual fields
    expect(
      _.omit(mirrorRecord.dataValues, ['createdAt', 'updatedAt']),
    ).to.deep.equal(
      _.omit(newRecord, [
        'qualifications', // mapped associated field
        'issuance', // mapped associated field
        'unitBlockStart', // virtual field
        'unitBlockEnd', // virtual field
        'unitCount', // virtual field
        'createdAt', // meta field
        'updatedAt', // meta field
      ]),
    );
  }).timeout(TEST_WAIT_TIME * 10);
});
