import _ from 'lodash';

import { Staging, Project, Unit } from '../models';
import { assertStagingRecordExists } from '../utils/data-assertions';

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
    await Staging.pushToDataLayer();
    res.json({ message: 'Staging Table committed to full node' });
  } catch (error) {
    res.status(400).json({
      message: 'Error commiting staging table',
      error: error.message,
    });

    console.trace(error);
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
