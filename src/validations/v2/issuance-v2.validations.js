import Joi from 'joi';

export const issuanceV2Schema = Joi.object({
  cadTrustIssuanceId: Joi.string().optional(),
  issuanceId: Joi.string().required(),
  issuanceDate: Joi.date().optional(),
  cadTrustVerificationId: Joi.string().required(),
  cadTrustMethodologyId: Joi.string().required(),
  cadTrustLocationId: Joi.string().optional(),
});
