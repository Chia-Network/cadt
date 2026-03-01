'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createRatingV2,
  getRatingV2,
  getAllRatingsV2,
  updateRatingV2,
  deleteRatingV2,
} from '../../controllers/v2/rating-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const ratingGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// Rating CRUD routes
router.post('/', createRatingV2);
router.get('/', validator.query(ratingGetSchema), getAllRatingsV2);
router.get('/:id', getRatingV2);
router.put('/:id', updateRatingV2);
router.delete('/:id', deleteRatingV2);

export default router;
