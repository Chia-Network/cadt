import _ from 'lodash';
import { Project, Unit, Staging } from '../models';
const THIRTY_SEC = 15000;

// Simulate 30 seconds passing before commited to node

export const updateProjectRecord = async (
  uuid,
  encodedRecord,
  stagingRecordId,
) => {
  const record = JSON.parse(atob(encodedRecord));
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (stagingRecordId) {
        await Project.destroy({
          where: {
            warehouseProjectId: uuid,
          },
        });
        await Project.create({
          ...record,
          warehouseProjectId: uuid,
        });
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }
    }, THIRTY_SEC);
  });
};

export const createProjectRecord = (uuid, encodedRecord, stagingRecordId) => {
  let record = JSON.parse(atob(encodedRecord));
  record = Array.isArray(record) ? _.head(record) : record;

  return new Promise((resolve) => {
    setTimeout(async () => {
      delete record.id;
      await Project.create({
        ...record,
        warehouseProjectId: uuid,
      });

      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      resolve();
    }, THIRTY_SEC);
  });
};

export const deleteProjectRecord = (uuid, stagingRecordId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await Project.destroy({
        where: {
          warehouseProjectId: uuid,
        },
      });

      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      resolve();
    }, THIRTY_SEC);
  });
};

export const updateUnitRecord = async (
  uuid,
  encodedRecord,
  stagingRecordId,
) => {
  await deleteUnitRecord(uuid);
  await createUnitRecord(uuid, encodedRecord);

  if (stagingRecordId) {
    await Staging.destroy({
      where: {
        id: stagingRecordId,
      },
    });
  }
};

export const createUnitRecord = (uuid, encodedRecord, stagingRecordId) => {
  let record = JSON.parse(atob(encodedRecord));
  record = Array.isArray(record) ? _.head(record) : record;

  return new Promise((resolve) => {
    setTimeout(async () => {
      delete record.id;
      await Unit.create({
        uuid,
        ...record,
      });

      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }
      resolve();
    }, THIRTY_SEC);
  });
};

export const deleteUnitRecord = (uuid, stagingRecordId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await Unit.destroy({
        where: {
          uuid,
        },
      });

      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }
      resolve();
    }, THIRTY_SEC);
  });
};
