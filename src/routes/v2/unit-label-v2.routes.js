'use strict';

import express from 'express';
import {
  createUnitLabelV2,
  getUnitLabelV2,
  getAllUnitLabelsV2,
  updateUnitLabelV2,
  deleteUnitLabelV2,
} from '../../controllers/v2/unit-label-v2.controller.js';

const router = express.Router();

// Unit-Label CRUD routes
router.post('/', createUnitLabelV2);
router.get('/', getAllUnitLabelsV2);
router.get('/:cadTrustUnitLabelId', getUnitLabelV2);
router.put('/:cadTrustUnitLabelId', updateUnitLabelV2);
router.delete('/:cadTrustUnitLabelId', deleteUnitLabelV2);

export default router;
