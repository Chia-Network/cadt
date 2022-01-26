import Joi from 'joi';

export const baseSchema = {
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
  projectLocations: Joi.array().min(1).optional(),
  labels: Joi.array().min(1).optional(),
  issuances: Joi.array().min(1).optional(),
  coBenefits: Joi.array().min(1).optional(),
  relatedProjects: Joi.array().min(1).optional(),
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
