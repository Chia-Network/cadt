import { uuid as uuidv4 } from 'uuidv4';
import { Staging, ProjectMock, Project } from '../models';

export const create = async (req, res) => {
  // When creating new projects assign a uuid to is so
  // multiple organizations will always have unique ids
  const uuid = uuidv4();

  try {
    await Staging.create({
      uuid,
      action: 'INSERT',
      table: 'Projects',
      data: JSON.stringify(req.body),
    });
    res.json('Added project to stage');
  } catch (err) {
    res.json(err);
  }
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
  const stagedData = {
    uuid: req.body.warehouseProjectId,
    action: 'UPDATE',
    table: 'Projects',
    data: JSON.stringify(req.body),
  };

  console.log(stagedData);

  Staging.create(stagedData)
    .then(() =>
      res.json({
        message: 'Project update added to staging',
      }),
    )
    .catch((err) =>
      res.json({
        message: 'Error adding update to stage',
        error: err,
      }),
    );
};

export const destroy = (req, res) => {
  const stagedData = {
    uuid: req.body.warehouseProjectId,
    action: 'DELETE',
    table: 'Projects',
  };

  Staging.create(stagedData)
    .then(() =>
      res.json({
        message: 'Project removal added to stage',
      }),
    )
    .catch(() =>
      res.json({
        message: 'Error adding project removal to stage',
      }),
    );
};
