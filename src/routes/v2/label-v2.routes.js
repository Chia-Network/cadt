'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createLabelV2,
  getLabelV2,
  getAllLabelsV2,
  updateLabelV2,
  deleteLabelV2,
} from '../../controllers/v2/label-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const labelGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// Label CRUD routes
router.post('/', createLabelV2);
router.get('/', validator.query(labelGetSchema), getAllLabelsV2);
router.get('/:id', getLabelV2);
router.put('/:id', updateLabelV2);
router.delete('/:id', deleteLabelV2);

export default router;
