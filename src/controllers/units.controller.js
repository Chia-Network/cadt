import { Unit, UnitMock } from '../models';

export const create = (req, res) => {
  res.json({
    message: 'Not Yet Implemented',
  });
};
export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(UnitMock.findAll());
    return;
  }

  res.json(await Unit.findAll());
};
export const findOne = async (req, res) => {
  if (req.query.useMock) {
    res.json(UnitMock.findOne(req.query.id));
    return;
  }

  res.json(await Unit.findByPk(req.query.id));
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
