import { Qualification, QualificationMock } from '../models';

export const create = (req, res) => {
  res.json({
    message: 'Not Yet Implemented',
  });
};
export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(QualificationMock.findAll());
    return;
  }

  res.json(await Qualification.findAll());
};
export const findOne = async (req, res) => {
  if (req.query.useMock) {
    res.json(QualificationMock.findOne(req.query.id));
    return;
  }

  res.json(await Qualification.findByPk(req.query.id));
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
