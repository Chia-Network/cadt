import Joi from 'joi';

export const governanceSubscribeSchema = Joi.object().keys({
  orgUid: Joi.string().required(),
});

export const setOrgListSchema = Joi.array().items(
  Joi.object({
    orgUid: Joi.string().required(),
  }),
);

export const governancePickListSchema = Joi.object().keys({
  registries: Joi.array().items(Joi.string()).min(1).required(),
  projectSector: Joi.array().items(Joi.string()).min(1).required(),
  projectType: Joi.array().items(Joi.string()).min(1).required(),
  coveredByNDC: Joi.array().items(Joi.string()).min(1).required(),
  projectStatusValues: Joi.array().items(Joi.string()).min(1).required(),
  unitMetric: Joi.array().items(Joi.string()).min(1).required(),
  methodology: Joi.array().items(Joi.string()).min(1).required(),
  validationBody: Joi.array().items(Joi.string()).min(1).required(),
  countries: Joi.array().items(Joi.string()).min(1).required(),
  ratingType: Joi.array().items(Joi.string()).min(1).required(),
  unitType: Joi.array().items(Joi.string()).min(1).required(),
  unitStatus: Joi.array().items(Joi.string()).min(1).required(),
  verificationBody: Joi.array().items(Joi.string()).min(1).required(),
  projectTags: Joi.array().items(Joi.string()).min(1).required(),
  unitTags: Joi.array().items(Joi.string()).min(1).required(),
  coBenefits: Joi.array().items(Joi.string()).min(1).required(),
  correspondingAdjustmentDeclaration: Joi.array()
    .items(Joi.string())
    .min(1)
    .required(),
  correspondingAdjustmentStatus: Joi.array()
    .items(Joi.string())
    .min(1)
    .required(),
  labelType: Joi.array().items(Joi.string()).min(1).required(),
});
