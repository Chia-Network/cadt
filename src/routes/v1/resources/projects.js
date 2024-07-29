'use strict';

import express from 'express';
import { ProjectController } from '../../../controllers/index.js';
import joiExpress from 'express-joi-validation';
import multer from 'multer';

import {
  projectsPostSchema,
  projectsGetQuerySchema,
  projectsUpdateSchema,
  projectsDeleteSchema,
} from '../../../validations/index.js';

const validator = joiExpress.createValidator({ passError: true });
const ProjectRouter = express.Router();
const upload = multer();

ProjectRouter.get('/', validator.query(projectsGetQuerySchema), (req, res) => {
  return req.query.warehouseProjectId
    ? ProjectController.findOne(req, res)
    : ProjectController.findAll(req, res);
});

ProjectRouter.post(
  '/',
  validator.body(projectsPostSchema),
  ProjectController.create,
);

ProjectRouter.put('/', validator.body(projectsUpdateSchema), (req, res) =>
  ProjectController.update(req, res, false),
);

ProjectRouter.put(
  '/transfer',
  validator.body(projectsUpdateSchema),
  (req, res) => ProjectController.transfer(req, res),
);

ProjectRouter.put(
  '/xlsx',
  upload.single('xlsx'),
  ProjectController.updateFromXLS,
);

ProjectRouter.delete(
  '/',
  validator.body(projectsDeleteSchema),
  ProjectController.destroy,
);

ProjectRouter.post('/batch', ProjectController.batchUpload);

export { ProjectRouter };
