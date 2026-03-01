'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createProjectMethodologyV2,
  getProjectMethodologyV2,
  getAllProjectMethodologiesV2,
  updateProjectMethodologyV2,
  deleteProjectMethodologyV2,
} from '../../controllers/v2/project-methodology-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const projectMethodologyGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// Project-Methodology CRUD routes
router.post('/', createProjectMethodologyV2);
router.get('/', validator.query(projectMethodologyGetSchema), getAllProjectMethodologiesV2);
router.get('/:cadTrustProjectMethodologyId', getProjectMethodologyV2);
router.put('/:cadTrustProjectMethodologyId', updateProjectMethodologyV2);
router.delete('/:cadTrustProjectMethodologyId', deleteProjectMethodologyV2);

export default router;
