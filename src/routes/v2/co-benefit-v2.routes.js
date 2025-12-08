'use strict';

import express from 'express';
import {
  createCoBenefitV2,
  getCoBenefitV2,
  getAllCoBenefitsV2,
  updateCoBenefitV2,
  deleteCoBenefitV2,
} from '../../controllers/v2/co-benefit-v2.controller.js';

const router = express.Router();

// Co-Benefit CRUD routes
router.post('/', createCoBenefitV2);
router.get('/', getAllCoBenefitsV2);
router.get('/:id', getCoBenefitV2);
router.put('/:id', updateCoBenefitV2);
router.delete('/:id', deleteCoBenefitV2);

export default router;
