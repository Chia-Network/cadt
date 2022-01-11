import chai from 'chai';
import supertest from 'supertest';
import app from '../../src/server';
import _ from 'lodash';

const { expect } = chai;

describe('Create Unit Integration', () => {
  it('gets all the projects available', async () => {
    const payload = {
      unitBlockStart: 'AXJJFSLGHSHEJ1000',
      unitBlockEnd: 'AXJJFSLGHSHEJ1010',
      countryJuridictionOfOwner: 'USA',
      inCountryJuridictionOfOwner: `${new Date()}`,
      tokenIssuanceHash: '0x7777',
    };
    const unitRes = await supertest(app).post('/v1/units').send(payload);

    expect(unitRes.statusCode).to.equal(200);
    expect(unitRes.body).to.deep.equal({
      message: 'Unit created successfully',
    });

    const stagingRes = await supertest(app).get('/v1/staging');
    const index = _.findIndex(stagingRes.body, (d) => {
      return _.find(d.diff.change, (change) => {
        return (
          change.unitBlockStart === payload.unitBlockStart &&
          change.unitBlockEnd === payload.unitBlockEnd &&
          change.countryJuridictionOfOwner ===
            payload.countryJuridictionOfOwner &&
          change.inCountryJuridictionOfOwner ===
            payload.inCountryJuridictionOfOwner &&
          change.tokenIssuanceHash === payload.tokenIssuanceHash
        );
      });
    });

    expect(stagingRes.body[index].diff.original).to.deep.equal({});

    const warehouseUnitId =
      stagingRes.body[index].diff.change[0].warehouseUnitId;

    expect(stagingRes.statusCode).to.equal(200);
    expect(index).to.not.equal(-1);

    const commitRes = await supertest(app).post('/v1/staging/commit');
    expect(stagingRes.statusCode).to.equal(200);
    expect(commitRes.body).to.deep.equal({
      message: 'Staging Table committed to full node',
    });

    const warehouseRes = await supertest(app)
      .get(`/v1/units`)
      .query({ warehouseUnitId });
  });
});
