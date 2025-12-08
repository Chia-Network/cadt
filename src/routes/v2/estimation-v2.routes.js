'use strict';

import express from 'express';
import {
  createEstimationV2,
  getEstimationV2,
  getAllEstimationsV2,
  updateEstimationV2,
  deleteEstimationV2,
} from '../../controllers/v2/estimation-v2.controller.js';

const router = express.Router();

// Estimation CRUD routes
router.post('/', createEstimationV2);
router.get('/', getAllEstimationsV2);
router.get('/:id', getEstimationV2);
router.put('/:id', updateEstimationV2);
router.delete('/:id', deleteEstimationV2);

export default router;
