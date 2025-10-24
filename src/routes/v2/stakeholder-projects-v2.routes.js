'use strict';

import express from 'express';
import {
  createStakeholderProjectV2,
  getStakeholderProjectV2,
  getAllStakeholderProjectsV2,
  updateStakeholderProjectV2,
  deleteStakeholderProjectV2,
} from '../../controllers/v2/stakeholder-projects-v2.controller.js';

const router = express.Router();

// Stakeholder-Project CRUD routes
router.post('/', createStakeholderProjectV2);
router.get('/', getAllStakeholderProjectsV2);
router.get('/:id', getStakeholderProjectV2);
router.put('/:id', updateStakeholderProjectV2);
router.delete('/:id', deleteStakeholderProjectV2);

export default router;
