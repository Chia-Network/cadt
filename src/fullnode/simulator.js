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
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });

        await Project.destroy({
          where: {
            warehouseProjectId: uuid,
          },
        });

        await Project.create({
          ...record,
          warehouseProjectId: uuid,
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
      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      delete record.id;
      await Project.create({
        ...record,
        warehouseProjectId: uuid,
      });

      resolve();
    }, THIRTY_SEC);
  });
};

export const deleteProjectRecord = (uuid, stagingRecordId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      await Project.destroy({
        where: {
          warehouseProjectId: uuid,
        },
      });

      resolve();
    }, THIRTY_SEC);
  });
};

export const updateUnitRecord = async (
  uuid,
  encodedRecord,
  stagingRecordId,
) => {
  if (stagingRecordId) {
    await Staging.destroy({
      where: {
        id: stagingRecordId,
      },
    });
  }

  await deleteUnitRecord(uuid);
  await createUnitRecord(uuid, encodedRecord);
};

export const createUnitRecord = (uuid, encodedRecord, stagingRecordId) => {
  let record = JSON.parse(atob(encodedRecord));
  record = Array.isArray(record) ? _.head(record) : record;

  return new Promise((resolve) => {
    setTimeout(async () => {
      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      delete record.id;
      await Unit.create({
        uuid,
        ...record,
      });

      resolve();
    }, THIRTY_SEC);
  });
};

export const deleteUnitRecord = (uuid, stagingRecordId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      await Unit.destroy({
        where: {
          uuid,
        },
      });

      resolve();
    }, THIRTY_SEC);
  });
};
