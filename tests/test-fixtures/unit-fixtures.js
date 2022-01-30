import supertest from 'supertest';
import chai from 'chai';
const { expect } = chai;

import app from '../../src/server';
import newUnit from '../test-data/new-unit.json';
import { UnitMirror } from '../../src/models';

export const createNewUnit = async (payload = newUnit) => {
  const result = await supertest(app).post('/v1/units').send(payload);

  expect(result.body).to.deep.equal({
    message: 'Unit staged successfully',
  });
  expect(result.statusCode).to.equal(200);

  return payload;
};

export const checkMirrorRecordExists = async (warehouseUnitId) => {
  const mirrorRecord = await UnitMirror.findByPk(warehouseUnitId);
  expect(mirrorRecord).to.be.ok;
};

export const checkMirrorRecordDoesNotExist = async (warehouseUnitId) => {
  const mirrorRecord = await UnitMirror.findByPk(warehouseUnitId);
  expect(mirrorRecord).to.not.be.ok;
};
