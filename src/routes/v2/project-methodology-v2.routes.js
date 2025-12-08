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
// Note: For join tables, we use composite primary keys
router.post('/', createProjectMethodologyV2);
router.get('/', getAllProjectMethodologiesV2);
router.get('/project/:projectId/methodology/:methodologyId', getProjectMethodologyV2);
router.put('/project/:projectId/methodology/:methodologyId', updateProjectMethodologyV2);
router.delete('/project/:projectId/methodology/:methodologyId', deleteProjectMethodologyV2);

export default router;
