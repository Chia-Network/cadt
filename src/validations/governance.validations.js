``import Joi from 'joi';

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
  verificationBody: Joi.array().items(Joi.string()).min(1).optional(),
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

// Strict schema for v2 based on the provided picklist structure
// Same strictness as v1, but with fields from the new picklist
export const governancePickListSchemaV2 = Joi.object().keys({
  projectSector: Joi.array().items(Joi.string()).min(1).required(),
  aefT2AuthorizationsSector: Joi.array().items(Joi.string()).min(1).required(),
  projectType: Joi.array().items(Joi.string()).min(1).required(),
  aefT2AuthorizationsActivityType: Joi.array().items(Joi.string()).min(1).required(),
  projectStatus: Joi.array().items(Joi.string()).min(1).required(),
  projectUnitMetric: Joi.array().items(Joi.string()).min(1).required(),
  unitMetric: Joi.array().items(Joi.string()).min(1).required(),
  projectValidationBody: Joi.array().items(Joi.string()).min(1).required(),
  verificationBody: Joi.array().items(Joi.string()).min(1).required(),
  methodologyName: Joi.array().items(Joi.string()).min(1).required(),
  validationType: Joi.array().items(Joi.string()).min(1).required(),
  unitType: Joi.array().items(Joi.string()).min(1).required(),
  unitStatus: Joi.array().items(Joi.string()).min(1).required(),
  locationCountry: Joi.array().items(Joi.string()).min(1).required(),
  aefT5AuthorizedEntitiesIncorporationCountry: Joi.array().items(Joi.string()).min(1).required(),
  locationMapType: Joi.array().items(Joi.string()).min(1).required(),
  stakeholderType: Joi.array().items(Joi.string()).min(1).required(),
  labelType: Joi.array().items(Joi.string()).min(1).required(),
  coBenefitId: Joi.array().items(Joi.string()).min(1).required(),
  ratingType: Joi.array().items(Joi.string()).min(1).required(),
  aefT2AuthorizationsMetric: Joi.array().items(Joi.string()).min(1).required(),
  aefT2AuthorizationsPurposesForAuthorization: Joi.array().items(Joi.string()).min(1).required(),
  aefT2AuthorizationsFirstTransferDefinitionOimp: Joi.array().items(Joi.string()).min(1).required(),
  aefT3ActionsType: Joi.array().items(Joi.string()).min(1).required(),
  aefT3ActionsMitigationType: Joi.array().items(Joi.string()).min(1).required(),
});
