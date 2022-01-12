import chai from 'chai';
import supertest from 'supertest';
import app from '../../src/server';
import _ from 'lodash';

import { WAIT_TIME } from '../../src/fullnode/simulator';

const { expect } = chai;

describe('Create Unit Integration', () => {
  beforeEach(async () => {
    await supertest(app).get(`/v1/staging/clean`);
  });

  it('splits an existing unit end-to-end', async () => {
    // Get a unit to split
    const allUnitsResult = await supertest(app).get('/v1/units');
    const unitRecord = _.head(allUnitsResult.body);
    const warehouseUnitIdToSplit = unitRecord.warehouseUnitId;
    const newUnitOwnerOrgUid = '35f92331-c8d7-4e9e-a8d2-cd0a86cbb2cf';

    const payload = {
      warehouseUnitId: warehouseUnitIdToSplit,
      records: [
        {
          unitCount: unitRecord.unitCount - 1,
          unitOwnerOrgUid: newUnitOwnerOrgUid,
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

    // The first unitOwnerOrgUid is was reassigned,
    // the second we not reassigned and should match the original ownership
    expect(splitRecord1.unitOwnerOrgUid).to.equal(newUnitOwnerOrgUid);
    expect(splitRecord2.unitOwnerOrgUid).to.equal(unitRecord.unitOwnerOrgUid);

    // expect each orgUid to be a valid org that is being obsserved
    // Get the organizations so we can check the right org was set
    const organizationResults = await supertest(app).get('/v1/organizations');

    expect(Object.keys(organizationResults.body)).to.contain(
      splitRecord1.unitOwnerOrgUid,
    );
    expect(Object.keys(organizationResults.body)).to.contain(
      splitRecord2.unitOwnerOrgUid,
    );

    expect(splitRecord1.unitCount).to.equal(9);
    expect(splitRecord2.unitCount).to.equal(1);

    // Expect the split unitscounts to add up to the original unit count
    expect(splitRecord1.unitCount + splitRecord2.unitCount).to.equal(
      originalRecord.unitCount,
    );

    // The rest of the fields should match the original for each split unit
    expect(splitRecord1.countryJuridictionOfOwner).to.equal(
      unitRecord.countryJuridictionOfOwner,
    );
    expect(splitRecord1.inCountryJuridictionOfOwner).to.equal(
      unitRecord.inCountryJuridictionOfOwner,
    );
    expect(splitRecord1.intendedBuyerOrgUid).to.equal(
      unitRecord.intendedBuyerOrgUid,
    );
    expect(splitRecord1.tags).to.equal(unitRecord.tags);
    expect(splitRecord1.tokenIssuanceHash).to.equal(
      unitRecord.tokenIssuanceHash,
    );

    expect(splitRecord2.countryJuridictionOfOwner).to.equal(
      unitRecord.countryJuridictionOfOwner,
    );
    expect(splitRecord2.inCountryJuridictionOfOwner).to.equal(
      unitRecord.inCountryJuridictionOfOwner,
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
    await new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const warehouseRes = await supertest(app)
            .get(`/v1/units`)
            .query({ warehouseUnitId: splitRecord1.warehouseUnitId });

          const newRecord1 = warehouseRes.body;

          expect(newRecord1.warehouseUnitId).to.equal(
            splitRecord1.warehouseUnitId,
          );
          expect(newRecord1.orgUid).to.equal(splitRecord1.orgUid);
          expect(newRecord1.unitOwnerOrgUid).to.equal(
            splitRecord1.unitOwnerOrgUid,
          );
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

          const warehouse2Res = await supertest(app)
            .get(`/v1/units`)
            .query({ warehouseUnitId: splitRecord2.warehouseUnitId });

          const newRecord2 = warehouse2Res.body;

          expect(newRecord2.warehouseUnitId).to.equal(
            splitRecord2.warehouseUnitId,
          );
          expect(newRecord2.orgUid).to.equal(splitRecord2.orgUid);
          expect(newRecord2.unitOwnerOrgUid).to.equal(
            splitRecord2.unitOwnerOrgUid,
          );
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

          // make sure the original record was deleted
          const warehouse3Res = await supertest(app)
            .get(`/v1/units`)
            .query({ warehouseUnitId: warehouseUnitIdToSplit });
          expect(warehouse3Res.body).to.equal(null);

          // Make sure the staging table is cleaned up
          const stagingRes3 = await supertest(app).get('/v1/staging');

          // There should be no staging records left
          expect(stagingRes3.body.length).to.equal(0);

          resolve();
        } catch (err) {
          reject(err);
        }
      }, WAIT_TIME * 3);
    });
  });

  it('creates a new unit end-to-end', async () => {
    // 1. Create a new unit
    // 2. verify the unit is in the staging tables
    // 3. verify the inferred data has been added to the unit record
    // 3. commit the staging tables
    // 4. verify that the staging table has the committed flag set to true
    // 5. verify the unit was commited to the database
    // 6. verify the staging table was cleaned up

    const payload = {
      serialNumberBlock: 'AXJJFSLGHSHEJ9000-AXJJFSLGHSHEJ9010',
      countryJuridictionOfOwner: 'USA',
      unitType: 'removal',
      unitIdentifier: 'XYZ',
      unitStatus: 'Held',
      correspondingAdjustmentDeclaration: 'Commited',
      correspondingAdjustmentStatus: 'Pending',
      inCountryJuridictionOfOwner: 'Maryland',
      unitsIssuanceLocation: 'TEST_LOCATION',
      unitRegistryLink: 'https://test.link',
      tokenIssuanceHash: '0x7777',
    };
    const unitRes = await supertest(app).post('/v1/units').send(payload);

    expect(unitRes.statusCode).to.equal(200);
    expect(unitRes.body).to.deep.equal({
      message: 'Unit created successfully',
    });

    // Get the organizations so we can check the right org was set
    const organizationResults = await supertest(app).get('/v1/organizations');
    const orgUid = Object.keys(organizationResults.body).find(
      (key) => organizationResults.body[key].writeAccess,
    );

    // Get the staging record we just created
    const stagingRes = await supertest(app).get('/v1/staging');
    const stagingRecord = _.head(stagingRes.body);

    // There is no original when creating new units
    expect(stagingRecord.diff.original).to.deep.equal({});

    const changeRecord = _.head(stagingRecord.diff.change);

    // make sure the inferred data was set to the staging record
    expect(changeRecord.orgUid).to.equal(orgUid);
    expect(changeRecord.unitOwnerOrgUid).to.equal(orgUid);

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
    await new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
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
          expect(newRecord.unitOwnerOrgUid).to.equal(orgUid);
          expect(newRecord.serialNumberBlock).to.equal(
            payload.serialNumberBlock,
          );
          expect(newRecord.countryJuridictionOfOwner).to.equal(
            payload.countryJuridictionOfOwner,
          );
          expect(newRecord.inCountryJuridictionOfOwner).to.equal(
            payload.inCountryJuridictionOfOwner,
          );
          expect(newRecord.tokenIssuanceHash).to.equal(
            payload.tokenIssuanceHash,
          );

          resolve();
        } catch (err) {
          reject(err);
        }
      }, WAIT_TIME * 2);
    });
  });
});
