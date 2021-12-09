'use strict';

import express from 'express';
import Joi from 'joi';
import { ProjectController } from '../../../controllers';
import joiExpress from 'express-joi-validation';

const validator = joiExpress.createValidator({});
const ProjectRouter = express.Router();

ProjectRouter.get('/', (req, res) => {
  return req.query.id
    ? ProjectController.findOne(req, res)
    : ProjectController.findAll(req, res);
});

const querySchema = Joi.object({
  currentRegistry: Joi.string().required(),
  registryOfOrigin: Joi.string().required(),
  originProjectId: Joi.string().required(),
  projectID: Joi.string().required(),
  program: Joi.string().required(),
  warehouseProjectId: Joi.string().required(),
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
  estimatedAnnualAverageEmissionReduction: Joi.string().required(),
});

ProjectRouter.post('/', validator.body(querySchema), ProjectController.create);

ProjectRouter.put('/', validator.body(querySchema), ProjectController.update);

const querySchemaDelete = {
  warehouseProjectId: Joi.string().required(),
};

ProjectRouter.delete(
  '/',
  validator.body(querySchemaDelete),
  ProjectController.destroy,
);

export { ProjectRouter };
