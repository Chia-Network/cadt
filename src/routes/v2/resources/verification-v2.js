import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import * as VerificationV2Controller from '../../../controllers/v2/verification-v2.controller.js';
import { paginationSchema } from '../../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const VerificationV2Router = express.Router();

const verificationGetSchema = Joi.object({
  ...paginationSchema,
  columns: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()),
  ).optional(),
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// CRUD routes for verification
VerificationV2Router.post('/', VerificationV2Controller.create);
VerificationV2Router.get('/', validator.query(verificationGetSchema), VerificationV2Controller.findAll);
VerificationV2Router.get('/:id', VerificationV2Controller.findOne);
VerificationV2Router.put('/:id', VerificationV2Controller.update);
VerificationV2Router.delete('/:id', VerificationV2Controller.destroy);

export { VerificationV2Router };
