'use strict';

import express from 'express';
import {
  createProjectMethodologyV2,
  getProjectMethodologyV2,
  getAllProjectMethodologiesV2,
  updateProjectMethodologyV2,
  deleteProjectMethodologyV2,
} from '../../controllers/v2/project-methodology-v2.controller.js';

const router = express.Router();

// Project-Methodology CRUD routes
router.post('/', createProjectMethodologyV2);
router.get('/', getAllProjectMethodologiesV2);
router.get('/:cadTrustProjectMethodologyId', getProjectMethodologyV2);
router.put('/:cadTrustProjectMethodologyId', updateProjectMethodologyV2);
router.delete('/:cadTrustProjectMethodologyId', deleteProjectMethodologyV2);

export default router;
