import Joi from 'joi';
import {
  newCobenefitScheme,
  newLocationScheme,
  newRatingScheme,
  newRelatedProjectScheme,
  newLabelScheme,
  newIssuanceScheme,
} from '../validations';

export const baseSchema = {
  // warehouseProjectId - derived upon creation
  // orgUid - derived upon creation
  currentRegistry: Joi.string().required(),
  projectId: Joi.string().required(),
  registryOfOrigin: Joi.string().required(),
  program: Joi.string().required(),
  projectName: Joi.string().required(),
  projectLink: Joi.string().required(),
  projectDeveloper: Joi.string().required(),
  sector: Joi.string().required(),
  projectType: Joi.string().required(),
  projectTags: Joi.string().optional(),
  coveredByNDC: Joi.string().required(),
  ndcInformation: Joi.string().required(),
  projectStatus: Joi.string().required(),
  projectStatusDate: Joi.date().required(),
  unitMetric: Joi.string().required(),
  methodology: Joi.string().required(),
  validationBody: Joi.string().optional(),
  validationDate: Joi.string().optional(),

  /* Child Tables */
  labels: Joi.array().items(newLabelScheme).min(1).optional(),
  issuances: Joi.array().items(newIssuanceScheme).min(1).optional(),
  coBenefits: Joi.array().items(newCobenefitScheme).min(1).optional(),
  relatedProjects: Joi.array().items(newRelatedProjectScheme).min(1).optional(),
  projectLocations: Joi.array().items(newLocationScheme).min(1).optional(),
  projectRatings: Joi.array().items(newRatingScheme).min(1).optional(),
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
