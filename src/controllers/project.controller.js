import { uuid as uuidv4 } from 'uuidv4';
import { Staging, ProjectMock } from '../models';

export const create = (req, res) => {
  // When creating new projects assign a uuid to is so
  // multiple organizations will always have unique ids
  const uuid = uuidv4();
  const stagedData = {
    uuid,
    action: 'INSERT',
    table: 'Projects',
    data: JSON.stringify(req.body),
  };

  Staging.create(stagedData)
    .then(() =>
      res.json({
        message: 'Project created successfully',
      }),
    )
    .catch(() =>
      res.json({
        message: 'Error creating new project',
      }),
    );
};

export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(ProjectMock.findAll());
    return;
  }

  res.json({
    message: 'Not Yet Implemented',
  });
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
  const stagedData = {
    uuid: req.body.uuid,
    action: 'UPDATE',
    table: 'Projects',
    data: JSON.stringify(req.body),
  };

  Staging.create(stagedData)
    .then(() =>
      res.json({
        message: 'Project created successfully',
      }),
    )
    .catch(() =>
      res.json({
        message: 'Error creating new project',
      }),
    );
};

export const destroy = (req, res) => {
  const stagedData = {
    uuid: req.body.uuid,
    action: 'DELETE',
    table: 'Projects',
  };

  Staging.create(stagedData)
    .then(() =>
      res.json({
        message: 'Project created successfully',
      }),
    )
    .catch(() =>
      res.json({
        message: 'Error creating new project',
      }),
    );
};
