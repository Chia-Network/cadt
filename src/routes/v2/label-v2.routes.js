'use strict';

import express from 'express';
import {
  createLabelV2,
  getLabelV2,
  getAllLabelsV2,
  updateLabelV2,
  deleteLabelV2,
} from '../../controllers/v2/label-v2.controller.js';

const router = express.Router();

// Label CRUD routes
router.post('/', createLabelV2);
router.get('/', getAllLabelsV2);
router.get('/:id', getLabelV2);
router.put('/:id', updateLabelV2);
router.delete('/:id', deleteLabelV2);

export default router;
