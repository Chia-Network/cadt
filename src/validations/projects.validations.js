import Joi from 'joi';
import {
  newCobenefitSchema,
  newLocationSchema,
  newRatingSchema,
  newRelatedProjectSchema,
  newLabelSchema,
  newIssuanceSchema,
  existingCobenefitSchema,
  existingLocationSchema,
  existingRatingSchema,
  existingRelatedProjectSchema,
  existingLabelSchema,
  existingIssuanceSchema,
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
  labels: Joi.array()
    .items(Joi.alternatives().try(newLabelSchema, existingLabelSchema))
    .min(1)
    .optional(),
  issuances: Joi.array()
    .items(Joi.alternatives().try(newIssuanceSchema, existingIssuanceSchema))
    .min(1)
    .optional(),
  coBenefits: Joi.array()
    .items(Joi.alternatives().try(newCobenefitSchema, existingCobenefitSchema))
    .min(1)
    .optional(),
  relatedProjects: Joi.array()
    .items(
      Joi.alternatives().try(
        newRelatedProjectSchema,
        existingRelatedProjectSchema,
      ),
    )
    .min(1)
    .optional(),
  projectLocations: Joi.array()
    .items(Joi.alternatives().try(newLocationSchema, existingLocationSchema))
    .min(1)
    .optional(),
  projectRatings: Joi.array()
    .items(Joi.alternatives().try(newRatingSchema, existingRatingSchema))
    .min(1)
    .optional(),
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
