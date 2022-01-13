import _ from 'lodash';
import { Project, Unit, Staging } from '../models';
export const WAIT_TIME = 1500;

// Simulate 30 seconds passing before commited to node

export const updateProjectRecord = async (
  uuid,
  encodedRecord,
  stagingRecordId,
) => {
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

        await Project.destroy({
          where: {
            warehouseProjectId: uuid,
          },
        });

        await Project.create({
          ...record,
          warehouseProjectId: uuid,
        });

        resolve();
      }
    }, WAIT_TIME);
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

      await Project.create({
        ...record,
        warehouseProjectId: uuid,
      });

      resolve();
    }, WAIT_TIME);
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
    }, WAIT_TIME);
  });
};

export const updateUnitRecord = async (
  uuid,
  encodedRecord,
  stagingRecordId,
) => {
  setTimeout(async () => {
    let record = JSON.parse(atob(encodedRecord));
    await Unit.create({
      ...record,
    });

    await Unit.destroy({
      where: {
        warehouseUnitId: uuid,
      },
    });

    if (stagingRecordId) {
      await Staging.destroy({
        where: {
          id: stagingRecordId,
        },
      });
    }
  }, WAIT_TIME);
};

export const createUnitRecord = (uuid, encodedRecord, stagingRecordId) => {
  let record = JSON.parse(atob(encodedRecord));
  record = Array.isArray(record) ? _.head(record) : record;

  return new Promise(async (resolve) => {
    setTimeout(async () => {
      if (stagingRecordId) {
        await Staging.destroy({
          where: {
            id: stagingRecordId,
          },
        });
      }

      await Unit.create({
        ...record,
      });

      resolve();
    }, WAIT_TIME);
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
          warehouseUnitId: uuid,
        },
      });

      resolve();
    }, WAIT_TIME);
  });
};
