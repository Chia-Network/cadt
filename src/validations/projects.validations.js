import Joi from 'joi';
import {
  cobenefitSchema,
  locationSchema,
  ratingSchema,
  relatedProjectSchema,
  labelSchema,
  issuanceSchema,
  estimationSchema,
} from '../validations';

import { pickListValidation } from '../utils/validation-utils';

export const baseSchema = {
  // warehouseProjectId - derived upon creation
  // orgUid - derived upon creation
  projectId: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  currentRegistry: Joi.string().allow(null).optional(),
  originProjectId: Joi.alternatives()
    .try(Joi.string(), Joi.number())
    .required(),
  registryOfOrigin: Joi.string().required(),
  program: Joi.string().allow(null).optional(),
  projectName: Joi.string().required(),
  projectLink: Joi.string().required(),
  projectDeveloper: Joi.string().required(),
  sector: Joi.string().required(),
  projectType: Joi.string().required(),
  projectTags: Joi.string().allow(null).optional(),
  coveredByNDC: Joi.string()
    .custom(pickListValidation('coveredByNDC'))
    .required(),
  ndcInformation: Joi.string().allow(null).optional(),
  projectStatus: Joi.string()
    .custom(pickListValidation('projectStatusValues', 'projectStatus'))
    .required(),
  projectStatusDate: Joi.date().required(),
  unitMetric: Joi.string().custom(pickListValidation('unitMetric')).required(),
  methodology: Joi.string().required(),
  methodology2: Joi.string().allow(null).optional(),
  validationBody: Joi.string().allow(null).optional(),
  validationDate: Joi.date().allow(null).optional(),
  description: Joi.string().allow(null).optional(),

  /* Child Tables */
  labels: Joi.array().items(labelSchema).min(1).allow(null).optional(),
  issuances: Joi.array().items(issuanceSchema).min(1).allow(null).optional(),
  coBenefits: Joi.array().items(cobenefitSchema).min(1).allow(null).optional(),
  relatedProjects: Joi.array()
    .items(relatedProjectSchema)
    .min(1)
    .allow(null)
    .optional(),
  projectLocations: Joi.array()
    .items(locationSchema)
    .min(1)
    .allow(null)
    .optional(),
  projectRatings: Joi.array().items(ratingSchema).min(1).allow(null).optional(),
  estimations: Joi.array()
    .items(estimationSchema)
    .min(1)
    .allow(null)
    .optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
};

export const projectsGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number(),
    limit: Joi.number(),
    search: Joi.string(),
    columns: Joi.array().items(Joi.string()).single(),
    orgUid: Joi.string(),
    warehouseProjectId: Joi.string(),
    xls: Joi.boolean(),
    projectIds: Joi.array().items(Joi.string()).single(),
  })
  .with('page', 'limit')
  .with('limit', 'page');

export const projectsPostSchema = Joi.object({
  ...baseSchema,
});

export const projectsUpdateSchema = Joi.object({
  warehouseProjectId: Joi.string().required(),
  ...baseSchema,
});

export const projectsDeleteSchema = Joi.object({
  warehouseProjectId: Joi.string().required(),
});
