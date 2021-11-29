import { Project, ProjectMock } from '../models';

export const create = (req, res) => {
  // create a blockchain node action and push to staging
  res.json({
    message: 'Not Yet Implemented',
  });
};

export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(ProjectMock.findAll());
    return;
  }

  res.json(await Project.findAll());
};

export const findOne = (req, res) => {
  if (req.query.useMock) {
    const record = ProjectMock.findOne(req.query.id);
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
