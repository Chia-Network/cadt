import Joi from 'joi';
import {
  cobenefitSchema,
  estimationSchema,
  issuanceSchema,
  labelSchema,
  locationSchema,
  ratingSchema,
  relatedProjectSchema,
} from '../validations';

import {
  genericFilterRegex,
  genericSortColumnRegex,
} from '../utils/string-utils';

import { pickListValidation } from '../utils/validation-utils';
import { CONFIG } from '../user-config.js';

const { CADT } = CONFIG();

const allowedColumns = [
  'warehouseProjectId',
  'currentRegistry',
  'registryOfOrigin',
  'program',
  'projectName',
  'projectLink',
  'projectDeveloper',
  'sector',
  'projectType',
  'NDCLinkage',
  'projectStatus',
  'unitMetric',
  'methodology',
  'methodologyVersion',
  'validationApproach',
  'projectTag',
  'estimatedAnnualAverageEmissionReduction',
  'timeStaged',
  'description',
];

export const projectsBaseSchema = {
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

export const projectsGetQuerySchema = Joi.object()
  .keys({
    page: Joi.number().min(1),
    limit: Joi.number().max(1000).min(1),
    search: Joi.string(),
    columns: Joi.array()
      .items(Joi.string().valid(...allowedColumns))
      .single()
      .optional()
      .max(CADT.REQUEST_CONTENT_LIMITS.PROJECTS.INCLUDE_COLUMNS_LEN),
    orgUid: Joi.string().optional(),
    warehouseProjectId: Joi.string().optional(),
    xls: Joi.boolean().optional(),
    projectIds: Joi.array()
      .items(Joi.string())
      .single()
      .optional()
      .max(CADT.REQUEST_CONTENT_LIMITS.PROJECTS.PROJECT_IDS_LEN),
    order: Joi.string().regex(genericSortColumnRegex).max(100).min(1),
    filter: Joi.string().regex(genericFilterRegex).max(100).min(1),
    onlyMarketplaceProjects: Joi.boolean(),
  })
  .when(Joi.object({ xls: Joi.exist() }).unknown(), {
    then: Joi.object({
      page: Joi.number().min(1).optional(),
      limit: Joi.number().max(100).min(1).optional(),
    }),
  })
  .with('page', 'limit')
  .with('limit', 'page');

export const projectsPostSchema = Joi.object({
  ...projectsBaseSchema,
});

export const projectsUpdateSchema = Joi.object({
  warehouseProjectId: Joi.string().required(),
  ...projectsBaseSchema,
});

export const projectsDeleteSchema = Joi.object({
  warehouseProjectId: Joi.string().required(),
});
