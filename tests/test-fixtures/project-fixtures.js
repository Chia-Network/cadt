import _ from 'lodash';

import supertest from 'supertest';
import { expect } from 'chai';

import app from '../../src/server';
import newProject from '../test-data/new-project.js';
import updateProjectJson from '../test-data/update-project.js';
import { ProjectMirror, Project } from '../../src/models';

export const createNewProject = async (payload = newProject) => {
  const result = await supertest(app).post('/v1/projects').send(payload);

  expect(_.get(result, 'body.message')).to.equal('Project staged successfully');
  expect(result.statusCode).to.equal(200);

  return payload;
};

export const updateProject = async (warehouseProjectId, originalRecord) => {
  updateProjectJson.warehouseProjectId = warehouseProjectId;

  // Since we are updating, let pull over the child table ids to
  // update the child tables instead of create new ones
  Object.keys(updateProjectJson).forEach((key) => {
    if (Array.isArray(updateProjectJson[key])) {
      updateProjectJson[key].forEach((record, index) => {
        record.id = originalRecord[key][index].id;
      });
    }
  });

  const result = await supertest(app)
    .put('/v1/projects')
    .send(updateProjectJson);

  expect(result.body).to.deep.equal({
    message: 'Project update added to staging',
    success: true,
  });
  expect(result.statusCode).to.equal(200);

  return updateProjectJson;
};

export const deleteProject = async (warehouseProjectId) => {
  const result = await supertest(app)
    .delete('/v1/projects')
    .send({ warehouseProjectId });
  expect(result.body).to.deep.equal({
    message: 'Project deleted successfully',
    success: true,
  });
  expect(result.statusCode).to.equal(200);
  return result;
};

export const getProject = async (warehouseProjectId) => {
  const result = await supertest(app)
    .get('/v1/projects')
    .query({ warehouseProjectId });

  expect(result.body).to.be.an('object');
  expect(result.body.warehouseProjectId).to.equal(warehouseProjectId);
  expect(result.statusCode).to.equal(200);
  return result.body;
};

export const getProjectByQuery = async (query = {}) => {
  const result = await supertest(app).get('/v1/projects').query(query);

  // expect(result.body).to.be.an('array');
  expect(result.statusCode).to.equal(200);

  return result.body;
};

export const checkProjectRecordExists = async (warehouseProjectId) => {
  const record = await Project.findByPk(warehouseProjectId);
  expect(record).to.be.ok;
};

export const checkProjectRecordDoesNotExist = async (warehouseProjectId) => {
  const record = await Project.findByPk(warehouseProjectId);
  expect(record).to.not.be.ok;
};

export const checkProjectMirrorRecordExists = async (warehouseProjectId) => {
  const mirrorRecord = await ProjectMirror.findByPk(warehouseProjectId);
  expect(mirrorRecord).to.be.ok;
};

export const checkProjectMirrorRecordDoesNotExist = async (
  warehouseProjectId,
) => {
  const mirrorRecord = await ProjectMirror.findByPk(warehouseProjectId);
  expect(mirrorRecord).to.not.be.ok;
};
