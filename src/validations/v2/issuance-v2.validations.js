import Joi from 'joi';

export const issuanceV2Schema = Joi.object({
  cadTrustIssuanceId: Joi.number().optional(),
  issuanceId: Joi.string().required(),
  issuanceDate: Joi.date().optional(),
  cadTrustVerificationId: Joi.number().required(),
  cadTrustMethodologyId: Joi.number().required(),
  cadTrustLocationId: Joi.number().optional(),
});
