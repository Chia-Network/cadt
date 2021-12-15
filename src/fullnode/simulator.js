import { Project, Unit } from '../models';
const THIRTY_SEC = 30000;

// Simulate 30 seconds passing before commited to node

export const updateProjectRecord = async (uuid, record) => {
  await deleteProjectRecord(uuid);
  await createProjectRecord(uuid, record);
};

export const createProjectRecord = (uuid, record) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await Project.create({
        ...record,
        warehouseProjectId: uuid,
      });
      resolve();
    }, THIRTY_SEC);
  });
};

export const deleteProjectRecord = (uuid) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await Project.destroy({
        where: {
          warehouseProjectId: uuid,
        },
      });
      resolve();
    }, THIRTY_SEC);
  });
};

export const updateUnitRecord = async (uuid, record) => {
  await deleteUnitRecord(uuid);
  await createUnitRecord(uuid, record);
};

export const createUnitRecord = (uuid, record) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await Unit.create({
        uuid,
        ...record,
      });
      resolve();
    }, THIRTY_SEC);
  });
};

export const deleteUnitRecord = (uuid) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await Unit.destroy({
        where: {
          uuid,
        },
      });
      resolve();
    }, THIRTY_SEC);
  });
};
