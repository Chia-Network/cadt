'use strict';

import express from 'express';
import {
  createRatingV2,
  getRatingV2,
  getAllRatingsV2,
  updateRatingV2,
  deleteRatingV2,
} from '../../controllers/v2/rating-v2.controller.js';

const router = express.Router();

// Rating CRUD routes
router.post('/', createRatingV2);
router.get('/', getAllRatingsV2);
router.get('/:id', getRatingV2);
router.put('/:id', updateRatingV2);
router.delete('/:id', deleteRatingV2);

export default router;
