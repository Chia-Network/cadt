import { Staging, StagingMock } from '../models';

export const create = (req, res) => {
  res.json({
    message: 'Not Yet Implemented',
  });
};

export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(StagingMock.findAll());
    return;
  }

  res.json(Staging.findAll());
};

export const findOne = async (req, res) => {
  if (req.query.useMock) {
    res.json(StagingMock.findOne(req.query.id));
    return;
  }

  res.json({
    message: 'Not Yet Implemented',
  });
};

export const update = (req, res) => {
  res.json({
    message: 'Not Yet Implemented',
  });
};

export const destroy = (req, res) => {
  res.json({
    message: 'Not Yet Implemented',
  });
};
