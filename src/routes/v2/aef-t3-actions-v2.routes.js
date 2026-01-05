'use strict';

import express from 'express';
import {
  createAefT3ActionsV2,
  getAefT3ActionsV2,
  getAllAefT3ActionsV2,
  updateAefT3ActionsV2,
  deleteAefT3ActionsV2,
} from '../../controllers/v2/aef-t3-actions-v2.controller.js';

const router = express.Router();

// AEF-T3-Actions CRUD routes
router.post('/', createAefT3ActionsV2);
router.get('/', getAllAefT3ActionsV2);
router.get('/:cadTrustAefT3ActionsId', getAefT3ActionsV2);
router.put('/:cadTrustAefT3ActionsId', updateAefT3ActionsV2);
router.delete('/:cadTrustAefT3ActionsId', deleteAefT3ActionsV2);

export default router;
