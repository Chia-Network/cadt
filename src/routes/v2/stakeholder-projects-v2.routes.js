'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createStakeholderProjectV2,
  getStakeholderProjectV2,
  getAllStakeholderProjectsV2,
  updateStakeholderProjectV2,
  deleteStakeholderProjectV2,
} from '../../controllers/v2/stakeholder-projects-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const stakeholderProjectsGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// Stakeholder-Project CRUD routes
router.post('/', createStakeholderProjectV2);
router.get('/', validator.query(stakeholderProjectsGetSchema), getAllStakeholderProjectsV2);
router.get('/:id', getStakeholderProjectV2);
router.put('/:id', updateStakeholderProjectV2);
router.delete('/:id', deleteStakeholderProjectV2);

export default router;
