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
  projectId: Joi.string().required(),
  originProjectId: Joi.string().required(),
  registryOfOrigin: Joi.string()
    .custom(pickListValidation('registries', 'registryOfOrigin'))
    .required(),
  program: Joi.string().optional(),
  projectName: Joi.string().required(),
  projectLink: Joi.string().required(),
  projectDeveloper: Joi.string().required(),
  sector: Joi.string()
    .custom(pickListValidation('projectSector', 'sector'))
    .required(),
  projectType: Joi.string()
    .custom(pickListValidation('projectType'))
    .required(),
  projectTags: Joi.string().optional(),
  coveredByNDC: Joi.string()
    .custom(pickListValidation('coveredByNDC'))
    .required(),
  ndcInformation: Joi.string().when('coveredByNDC', {
    is: Joi.exist().valid('Inside NDC'),
    then: Joi.required(),
  }),
  projectStatus: Joi.string()
    .custom(pickListValidation('projectStatusValues', 'projectStatus'))
    .required(),
  projectStatusDate: Joi.date().required(),
  unitMetric: Joi.string().custom(pickListValidation('unitMetric')).required(),
  methodology: Joi.string()
    .custom(pickListValidation('methodology'))
    .required(),
  validationBody: Joi.string()
    .custom(pickListValidation('validationBody'))
    .optional(),
  validationDate: Joi.date().optional(),

  /* Child Tables */
  labels: Joi.array().items(labelSchema).min(1).optional(),
  issuances: Joi.array().items(issuanceSchema).min(1).optional(),
  coBenefits: Joi.array().items(cobenefitSchema).min(1).optional(),
  relatedProjects: Joi.array().items(relatedProjectSchema).min(1).optional(),
  projectLocations: Joi.array().items(locationSchema).min(1).optional(),
  projectRatings: Joi.array().items(ratingSchema).min(1).optional(),
  estimations: Joi.array().items(estimationSchema).min(1).optional(),
  timeStaged: Joi.date().timestamp().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
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
  })
  .with('page', 'limit');

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
