'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createCoBenefitV2,
  getCoBenefitV2,
  getAllCoBenefitsV2,
  updateCoBenefitV2,
  deleteCoBenefitV2,
} from '../../controllers/v2/co-benefit-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const coBenefitGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// Co-Benefit CRUD routes
router.post('/', createCoBenefitV2);
router.get('/', validator.query(coBenefitGetSchema), getAllCoBenefitsV2);
router.get('/:id', getCoBenefitV2);
router.put('/:id', updateCoBenefitV2);
router.delete('/:id', deleteCoBenefitV2);

export default router;
