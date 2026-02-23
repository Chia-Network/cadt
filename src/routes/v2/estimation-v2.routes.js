'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createEstimationV2,
  getEstimationV2,
  getAllEstimationsV2,
  updateEstimationV2,
  deleteEstimationV2,
} from '../../controllers/v2/estimation-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const estimationGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// Estimation CRUD routes
router.post('/', createEstimationV2);
router.get('/', validator.query(estimationGetSchema), getAllEstimationsV2);
router.get('/:id', getEstimationV2);
router.put('/:id', updateEstimationV2);
router.delete('/:id', deleteEstimationV2);

export default router;
