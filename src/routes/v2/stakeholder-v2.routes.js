'use strict';

import express from 'express';
import {
  createStakeholderV2,
  getStakeholderV2,
  getAllStakeholdersV2,
  updateStakeholderV2,
  deleteStakeholderV2,
} from '../../controllers/v2/stakeholder-v2.controller.js';

const router = express.Router();

// Stakeholder CRUD routes
router.post('/', createStakeholderV2);
router.get('/', getAllStakeholdersV2);
router.get('/:id', getStakeholderV2);
router.put('/:id', updateStakeholderV2);
router.delete('/:id', deleteStakeholderV2);

export default router;
