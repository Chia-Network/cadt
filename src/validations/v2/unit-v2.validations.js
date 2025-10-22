import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const unitV2Schema = Joi.object({
  cadTrustUnitId: Joi.string().optional(),
  unitSerialId: Joi.string().required(),
  unitStartBlock: Joi.string().required(),
  unitEndBlock: Joi.string().required(),
  unitCount: Joi.number().optional(),
  unitType: Joi.string()
    .custom(pickListValidation('unitType'))
    .optional(),
  unitVintageYear: Joi.number().required(),
  unitStatus: Joi.string()
    .custom(pickListValidation('unitStatus'))
    .optional(),
  unitStatusReason: Joi.string().optional(),
  unitStatusDate: Joi.date().optional(),
  unitRetirementDetail: Joi.string().optional(),
  unitRetirementBeneficiary: Joi.string().optional(),
  unitRetirementBeneficiaryId: Joi.string().optional(),
  unitLink: Joi.string().optional(),
  unitMetric: Joi.string()
    .custom(pickListValidation('unitMetric'))
    .optional(),
  unitCurrentOwner: Joi.string().optional(),
  unitItmosReferenceId: Joi.string().optional(),
  cadTrustIssuanceId: Joi.string().required(),
});
