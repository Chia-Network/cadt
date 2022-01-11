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

  it('creates a new unit end-to-end', async () => {
    // 1. Create a new unit
    // 2. verify the unit is in the staging tables
    // 3. verify the inferred data has been added to the unit record
    // 3. commit the staging tables
    // 4. verify that the staging table has the committed flag set to true
    // 5. verify the unit was commited to the database
    // 6. verify the staging table was cleaned up

    const payload = {
      unitBlockStart: 'AXJJFSLGHSHEJ1000',
      unitBlockEnd: 'AXJJFSLGHSHEJ1010',
      countryJuridictionOfOwner: 'USA',
      inCountryJuridictionOfOwner: 'Maryland',
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

    const commitRes = await supertest(app).post('/v1/staging/commit');
    expect(stagingRes.statusCode).to.equal(200);
    expect(commitRes.body).to.deep.equal({
      message: 'Staging Table committed to full node',
    });

    const stagingRes2 = await supertest(app).get('/v1/staging');
    expect(_.head(stagingRes2.body).commited).to.equal(true);

    await new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const warehouseRes = await supertest(app)
            .get(`/v1/units`)
            .query({ warehouseUnitId });

          const newRecord = warehouseRes.body;

          expect(newRecord.warehouseUnitId).to.equal(warehouseUnitId);
          expect(newRecord.orgUid).to.equal(orgUid);
          expect(newRecord.unitOwnerOrgUid).to.equal(orgUid);
          expect(newRecord.unitBlockStart).to.equal(payload.unitBlockStart);
          expect(newRecord.unitBlockEnd).to.equal(payload.unitBlockEnd);
          expect(newRecord.countryJuridictionOfOwner).to.equal(
            payload.countryJuridictionOfOwner,
          );
          expect(newRecord.inCountryJuridictionOfOwner).to.equal(
            payload.inCountryJuridictionOfOwner,
          );
          expect(newRecord.tokenIssuanceHash).to.equal(
            payload.tokenIssuanceHash,
          );

          // Make sure the staging table is cleaned up
          const stagingRes3 = await supertest(app).get('/v1/staging');

          // There should be no staging records left
          expect(stagingRes3.body.length).to.equal(0);

          resolve();
        } catch (err) {
          reject(err);
        }
      }, WAIT_TIME + 1000);
    });
  });
});
