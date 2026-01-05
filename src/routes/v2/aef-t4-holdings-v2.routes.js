'use strict';

import express from 'express';
import {
  createAefT4HoldingsV2,
  getAefT4HoldingsV2,
  getAllAefT4HoldingsV2,
  updateAefT4HoldingsV2,
  deleteAefT4HoldingsV2,
} from '../../controllers/v2/aef-t4-holdings-v2.controller.js';

const router = express.Router();

// AEF-T4-Holdings CRUD routes
router.post('/', createAefT4HoldingsV2);
router.get('/', getAllAefT4HoldingsV2);
router.get('/:cadTrustAefT4HoldingsId', getAefT4HoldingsV2);
router.put('/:cadTrustAefT4HoldingsId', updateAefT4HoldingsV2);
router.delete('/:cadTrustAefT4HoldingsId', deleteAefT4HoldingsV2);

export default router;
