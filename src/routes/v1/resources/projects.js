'use strict';

import express from 'express';
import Joi from 'joi';
import { ProjectController } from '../../../controllers';
import joiExpress from 'express-joi-validation';

const validator = joiExpress.createValidator({});
const ProjectRouter = express.Router();

const querySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    search: Joi.string(),
  })
  .with('page', 'limit');

ProjectRouter.get('/', validator.query(querySchema), (req, res) => {
  return req.query.warehouseProjectId
    ? ProjectController.findOne(req, res)
    : ProjectController.findAll(req, res);
});

const baseSchema = {
  orgUid: Joi.string().required(),
  currentRegistry: Joi.string().required(),
  registryOfOrigin: Joi.string().required(),
  originProjectId: Joi.string().required(),
  projectId: Joi.string().required(),
  program: Joi.string().required(),
  projectName: Joi.string().required(),
  projectLink: Joi.string().required(),
  projectDeveloper: Joi.string().required(),
  sector: Joi.string().required(),
  projectType: Joi.string().required(),
  coveredByNDC: Joi.number().required(),
  NDCLinkage: Joi.string().required(),
  projectStatus: Joi.string().required(),
  projectStatusDate: Joi.string().required(),
  unitMetric: Joi.string().required(),
  methodology: Joi.string().required(),
  methodologyVersion: Joi.number().required(),
  validationApproach: Joi.string().required(),
  validationDate: Joi.string().required(),
  projectTag: Joi.string().required(),
  estimatedAnnualAverageEmissionReduction: Joi.number().required(),
};

const postSchema = Joi.object({
  ...baseSchema,
});

ProjectRouter.post('/', validator.body(postSchema), ProjectController.create);

const updateSchema = Joi.object({
  warehouseProjectId: Joi.string().required(),
  ...baseSchema,
});

ProjectRouter.put('/', validator.body(updateSchema), ProjectController.update);

const deleteSchema = Joi.object({
  warehouseProjectId: Joi.string().required(),
});

ProjectRouter.delete(
  '/',
  validator.body(deleteSchema),
  ProjectController.destroy,
);

export { ProjectRouter };
