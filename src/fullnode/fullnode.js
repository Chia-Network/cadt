import * as simulator from './simulator';

export const updateProjectRecord = async (uuid, record, stagingRecordId) => {
  await simulator.updateProjectRecord(uuid, record, stagingRecordId);
};

export const createProjectRecord = async (uuid, record, stagingRecordId) => {
  await simulator.createProjectRecord(uuid, record, stagingRecordId);
};

export const deleteProjectRecord = async (uuid, stagingRecordId) => {
  await simulator.deleteProjectRecord(uuid, stagingRecordId);
};

export const updateUnitRecord = async (uuid, record, stagingRecordId) => {
  await simulator.updateUnitRecord(uuid, record, stagingRecordId);
};

export const createUnitRecord = async (uuid, record, stagingRecordId) => {
  await simulator.createUnitRecord(uuid, record, stagingRecordId);
};

export const deleteUnitRecord = async (uuid, stagingRecordId) => {
  await simulator.deleteUnitRecord(uuid, stagingRecordId);
};
