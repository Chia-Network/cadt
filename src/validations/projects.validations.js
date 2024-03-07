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

import {
  genericFilterRegex,
  genericSortColumnRegex,
} from '../utils/string-utils';

import { pickListValidation } from '../utils/validation-utils';

export const baseSchema = {
  // warehouseProjectId - derived upon creation
  // orgUid - derived upon creation
  currentRegistry: Joi.string().allow(null).optional(),
  projectId: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
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
  labels: Joi.array().items(labelSchema).min(1).optional(),
  issuances: Joi.array().items(issuanceSchema).min(1).optional(),
  coBenefits: Joi.array().items(cobenefitSchema).min(1).optional(),
  relatedProjects: Joi.array().items(relatedProjectSchema).min(1).optional(),
  projectLocations: Joi.array().items(locationSchema).min(1).optional(),
  projectRatings: Joi.array().items(ratingSchema).min(1).optional(),
  estimations: Joi.array().items(estimationSchema).min(1).optional(),
  updatedAt: Joi.date().allow(null).optional(),
  createdAt: Joi.date().allow(null).optional(),
  timeStaged: Joi.date().timestamp().allow(null).optional(),
};

export const projectsGetQuerySchema = Joi.object({
  page: Joi.number().optional(),
  limit: Joi.number().max(100).min(1).optional(),
  search: Joi.string().optional(),
  columns: Joi.array().items(Joi.string()).single().optional(),
  orgUid: Joi.string().optional(),
  warehouseProjectId: Joi.string().optional(),
  xls: Joi.boolean().optional(),
  projectIds: Joi.array().items(Joi.string()).single().optional(),
  order: Joi.string().regex(genericSortColumnRegex).optional(),
  filter: Joi.string().regex(genericFilterRegex).optional(),
  onlyMarketplaceProjects: Joi.boolean().optional(),
}).when(Joi.object({ warehouseProjectId: Joi.string().required() }).unknown(), {
  then: Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
  }),
  otherwise: Joi.object({
    page: Joi.number().required(),
    limit: Joi.number().required(),
  }),
});

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
