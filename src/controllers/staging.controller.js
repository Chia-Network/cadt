import _ from 'lodash';
import * as fullNode from '../fullnode';

import { Staging, Project, Unit } from '../models';
import {
  assertStagingRecordExists,
  assertUnitRecordExists,
  assertProjectRecordExists,
} from '../utils/data-assertions';

export const findAll = async (req, res) => {
  try {
    const stagingData = await Staging.findAll();

    const response = await Promise.all(
      stagingData.map(async (data) => {
        const workingData = _.cloneDeep(data.dataValues);
        workingData.diff = {};
        if (workingData.action === 'INSERT') {
          workingData.diff.original = {};
          workingData.diff.change = JSON.parse(workingData.data);
        }

        if (workingData.action === 'UPDATE') {
          let original;
          if (workingData.table === 'Projects') {
            original = await Project.findOne({
              where: { warehouseProjectId: workingData.uuid },
              include: Project.getAssociatedModels(),
            });
          }

          if (workingData.table === 'Units') {
            original = await Unit.findOne({
              where: { warehouseUnitId: workingData.uuid },
              include: Unit.getAssociatedModels(),
            });
          }

          workingData.diff.original = original;
          workingData.diff.change = JSON.parse(workingData.data);
        }

        if (workingData.action === 'DELETE') {
          let original;
          if (workingData.table === 'Projects') {
            original = await Project.findOne({
              where: { warehouseProjectId: workingData.uuid },
            });
          }

          if (workingData.table === 'Units') {
            original = await Unit.findOne({
              where: { warehouseUnitId: workingData.uuid },
            });
          }

          workingData.diff.original = original;
          workingData.diff.change = {};
        }

        delete workingData.data;

        return workingData;
      }),
    );

    res.json(response);
  } catch (error) {
    res.status(400).json({
      message: 'Error retreiving staging table',
      error: error.message,
    });
  }
};

export const commit = async (req, res) => {
  try {
    const queryResponses = await Staging.findAll();

    await Promise.all(
      queryResponses.map(async (queryResponse) => {
        const stagingRecord = queryResponse.dataValues;

        const {
          id: stagingRecordId,
          uuid,
          table,
          action,
          commited,
          data: rawData,
        } = stagingRecord;
        let data = JSON.parse(rawData);

        if (table === 'Projects' && !commited) {
          const customAssertionMessage = `The project record for the warehouseProjectId: ${uuid} does not exist. Please remove ${uuid} from the staging table and try to commit again.`;
          switch (action) {
            case 'INSERT':
              data.warehouseUnitId = uuid;
              fullNode.createProjectRecord(uuid, data, stagingRecordId);
              break;
            case 'UPDATE':
              await assertProjectRecordExists(uuid, customAssertionMessage);
              fullNode.updateProjectRecord(uuid, data, stagingRecordId);
              break;
            case 'DELETE':
              await assertProjectRecordExists(uuid, customAssertionMessage);
              fullNode.deleteProjectRecord(uuid, stagingRecordId);
              break;
          }
        } else if (table === 'Units' && !commited) {
          const customAssertionMessage = `The unit record for the warehouseUnitId: ${uuid} does not exist. Please remove ${uuid} from the staging table and try to commit again.`;
          switch (action) {
            case 'INSERT':
              fullNode.createUnitRecord(uuid, data, stagingRecordId);
              break;
            case 'UPDATE':
              await assertUnitRecordExists(uuid, customAssertionMessage);
              fullNode.updateUnitRecord(uuid, data, stagingRecordId);
              break;
            case 'DELETE':
              await assertUnitRecordExists(uuid, customAssertionMessage);
              fullNode.deleteUnitRecord(uuid, stagingRecordId);
              break;
          }
        }

        // set the commited flag to true
        await Staging.update(
          { commited: true },
          { where: { id: stagingRecordId } },
        );
      }),
    );

    res.json({ message: 'Staging Table committed to full node' });
  } catch (error) {
    res.status(400).json({
      message: 'Error commiting staging table',
      error: error.message,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    await assertStagingRecordExists(req.body.uuid);
    await Staging.destroy({
      where: {
        uuid: req.body.uuid,
      },
    });
    res.json({
      message: 'Deleted from stage',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Staging Record can not be removed.',
      error: error.message,
    });
  }
};

export const clean = async (req, res) => {
  try {
    await Staging.destroy({
      where: {},
      truncate: true,
    });
    res.json({
      message: 'Staging Data Cleaned',
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};
