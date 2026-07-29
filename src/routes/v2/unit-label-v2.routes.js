'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createUnitLabelV2,
  getUnitLabelV2,
  getAllUnitLabelsV2,
  updateUnitLabelV2,
  deleteUnitLabelV2,
} from '../../controllers/v2/unit-label-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const unitLabelGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// Unit-Label CRUD routes
router.post('/', createUnitLabelV2);
router.get('/', validator.query(unitLabelGetSchema), getAllUnitLabelsV2);
router.get('/:cadTrustUnitLabelId', getUnitLabelV2);
router.put('/:cadTrustUnitLabelId', updateUnitLabelV2);
router.delete('/:cadTrustUnitLabelId', deleteUnitLabelV2);

export default router;
