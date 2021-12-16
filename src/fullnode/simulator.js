import { Project, Unit, Staging } from '../models';
const THIRTY_SEC = 30000;

// Simulate 30 seconds passing before commited to node

export const updateProjectRecord = async (uuid, record, stagingRecordId) => {
  await deleteProjectRecord(uuid);
  await createProjectRecord(uuid, record);

  if (stagingRecordId) {
    await Staging.destroy({
      where: {
        id: stagingRecordId,
      },
    });
  }
};

export const createProjectRecord = (uuid, record, stagingRecordId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
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

export const updateUnitRecord = async (uuid, record, stagingRecordId) => {
  await deleteUnitRecord(uuid);
  await createUnitRecord(uuid, record);

  if (stagingRecordId) {
    await Staging.destroy({
      where: {
        id: stagingRecordId,
      },
    });
  }
};

export const createUnitRecord = (uuid, record, stagingRecordId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
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
