'use strict';

import express from 'express';
import { ProjectController } from '../../../controllers';
const ProjectRouter = express.Router();

ProjectRouter.get('/', (req, res) => {
  return req.query.id
    ? ProjectController.findOne(req, res)
    : ProjectController.findAll(req, res);
});

ProjectRouter.post('/', ProjectController.create);
ProjectRouter.put('/', ProjectController.update);
ProjectRouter.delete('/', ProjectController.destroy);

export { ProjectRouter };
