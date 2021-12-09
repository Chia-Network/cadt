import { Staging, StagingMock } from '../models';
import _ from 'lodash';
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
        const Model = workingData.table === 'Projects' ? Project : Unit;
        const original = await Model.findOne({
          where: { uuid: workingData.uuid },
        });
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

export const destroy = (req, res) => {
  Staging.destroy({
    where: {
      uuid: req.body.uuid,
    },
  })
    .then(() => {
      res.json({
        message: 'Deleted',
      });
    })
    .catch((err) => {
      res.json({
        message: err,
      });
    });
};
