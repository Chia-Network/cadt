import * as simulator from './simulator';

export const updateProjectRecord = async (uuid, record) => {
  await simulator.updateProjectRecord(uuid, record);
};

export const createProjectRecord = async (uuid, record) => {
  await simulator.createProjectRecord(uuid, record);
};

export const deleteProjectRecord = async (uuid) => {
  await simulator.deleteProjectRecord(uuid);
};

export const updateUnitRecord = async (uuid, record) => {
  await simulator.updateUnitRecord(uuid, record);
};

export const createUnitRecord = async (uuid, record) => {
  await simulator.createUnitRecord(uuid, record);
};

export const deleteUnitRecord = async (uuid) => {
  await simulator.deleteUnitRecord(uuid);
};
