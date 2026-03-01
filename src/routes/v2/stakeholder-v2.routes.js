'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createStakeholderV2,
  getStakeholderV2,
  getAllStakeholdersV2,
  updateStakeholderV2,
  deleteStakeholderV2,
} from '../../controllers/v2/stakeholder-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const stakeholderGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// Stakeholder CRUD routes
router.post('/', createStakeholderV2);
router.get('/', validator.query(stakeholderGetSchema), getAllStakeholdersV2);
router.get('/:id', getStakeholderV2);
router.put('/:id', updateStakeholderV2);
router.delete('/:id', deleteStakeholderV2);

export default router;
