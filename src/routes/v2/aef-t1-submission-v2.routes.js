'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createAefT1SubmissionV2,
  getAefT1SubmissionV2,
  getAllAefT1SubmissionsV2,
  updateAefT1SubmissionV2,
  deleteAefT1SubmissionV2,
} from '../../controllers/v2/aef-t1-submission-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const aefT1SubmissionGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// AEF-T1-Submission CRUD routes
router.post('/', createAefT1SubmissionV2);
router.get('/', validator.query(aefT1SubmissionGetSchema), getAllAefT1SubmissionsV2);
router.get('/:cadTrustAefT1SubmissionId', getAefT1SubmissionV2);
router.put('/:cadTrustAefT1SubmissionId', updateAefT1SubmissionV2);
router.delete('/:cadTrustAefT1SubmissionId', deleteAefT1SubmissionV2);

export default router;
