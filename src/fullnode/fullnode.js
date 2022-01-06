import * as simulator from './simulator';

export const updateProjectRecord = async (uuid, record, stagingRecordId) => {
  const encoded = btoa(JSON.stringify(record));
  await simulator.updateProjectRecord(uuid, encoded, stagingRecordId);
};

export const createProjectRecord = async (uuid, record, stagingRecordId) => {
  const encoded = btoa(JSON.stringify(record));
  await simulator.createProjectRecord(uuid, encoded, stagingRecordId);
};

export const deleteProjectRecord = async (uuid, stagingRecordId) => {
  await simulator.deleteProjectRecord(uuid, stagingRecordId);
};

export const updateUnitRecord = async (uuid, record, stagingRecordId) => {
  if (Array.isArray(record)) {
    record.forEach(async (_record, index) => {
      const encoded = btoa(JSON.stringify(_record));
      await simulator.updateUnitRecord(
        // we need to pass in the uuid only one to track
        index === record.length - 1 ? uuid : _record.uuid,
        encoded,
        stagingRecordId,
      );
    });
  } else {
    const encoded = btoa(JSON.stringify(record));
    await simulator.updateUnitRecord(uuid, record, stagingRecordId);
  }
};

export const createUnitRecord = async (uuid, record, stagingRecordId) => {
  const encoded = btoa(JSON.stringify(record));
  await simulator.createUnitRecord(uuid, encoded, stagingRecordId);
};

export const deleteUnitRecord = async (uuid, stagingRecordId) => {
  await simulator.deleteUnitRecord(uuid, stagingRecordId);
};
