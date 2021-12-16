import _ from 'lodash';
import * as fullNode from '../fullnode';
import { Staging, StagingMock, Project, Unit } from '../models';

export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(StagingMock.findAll());
    return;
  }

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
          });
        }

        if (workingData.table === 'Units') {
          original = await Unit.findOne({
            where: { uuid: workingData.uuid },
          });
        }

        workingData.diff.original = original;
        workingData.diff.change = JSON.parse(workingData.data);
      }

      if (workingData.action === 'DELETE') {
        workingData.diff.original = JSON.parse(workingData.data);
        workingData.diff.change = {};
      }

      delete workingData.data;

      return workingData;
    }),
  );

  res.json(response);
};

export const commit = async (req, res) => {
  const queryResponse = await Staging.findAll();
  const stagingRecords = queryResponse.dataValues;
  stagingRecords.forEach(async (stagingRecord) => {
    const {
      id: stagingRecordId,
      uuid,
      table,
      action,
      data: rawData,
    } = stagingRecord;
    const data = JSON.parse(rawData);

    await Staging.update(
      { commited: true },
      { where: { id: stagingRecordId } },
    );

    if (table === 'Projects') {
      switch (action) {
        case 'INSERT':
          fullNode.createProjectRecord(uuid, data, stagingRecordId);
          break;
        case 'UPDATE':
          fullNode.updateProjectRecord(uuid, data, stagingRecordId);
          break;
        case 'DELETE':
          fullNode.deleteProjectRecord(uuid, stagingRecordId);
          break;
      }
    } else if (table === 'Unit') {
      switch (action) {
        case 'INSERT':
          fullNode.createUnitRecord(uuid, data, stagingRecordId);
          break;
        case 'UPDATE':
          fullNode.updateUnitRecord(uuid, data, stagingRecordId);
          break;
        case 'DELETE':
          fullNode.deleteUnitRecord(uuid, stagingRecordId);
          break;
      }
    }
  });
  res.json({ message: 'Staging Table committed to full node' });
};

export const destroy = (req, res) => {
  Staging.destroy({
    where: {
      uuid: req.body.uuid,
    },
  })
    .then(() => {
      res.json({
        message: 'Deleted from stage',
      });
    })
    .catch((err) => {
      res.json({
        message: err,
      });
    });
};
