import _ from 'lodash';

import { Staging } from '../models';
import { assertStagingRecordExists } from '../utils/data-assertions';

export const findAll = async (req, res) => {
  try {
    const stagingData = await Staging.findAll();

    const response = await Promise.all(
      stagingData.map(async (stagingRecord) => {
        const { uuid, table, action, data } = stagingRecord;
        const workingData = _.cloneDeep(stagingRecord.dataValues);
        workingData.diff = await Staging.getDiffObject(
          uuid,
          table,
          action,
          data,
        );

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
