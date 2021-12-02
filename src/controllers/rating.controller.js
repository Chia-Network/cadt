import { RatingMock } from '../models';

export const create = (req, res) => {
  res.json({
    message: 'Not Yet Implemented',
  });
};

export const findAll = (req, res) => {
  if (req.query.useMock) {
    res.json(RatingMock.findAll());
    return;
  }

  res.json({
    message: 'Not Yet Implemented',
  });
};

export const findOne = (req, res) => {
  if (req.query.useMock) {
    const record = RatingMock.findOne(req.query.id);
    if (record) {
      res.json(record);
    } else {
      res.json({ message: 'Not Found' });
    }

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
