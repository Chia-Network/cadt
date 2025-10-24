'use strict';

import express from 'express';
import {
  createAefT2AuthorizationsV2,
  getAefT2AuthorizationsV2,
  getAllAefT2AuthorizationsV2,
  updateAefT2AuthorizationsV2,
  deleteAefT2AuthorizationsV2,
} from '../../controllers/v2/aef-t2-authorizations-v2.controller.js';

const router = express.Router();

// AEF-T2-Authorizations CRUD routes
router.post('/', createAefT2AuthorizationsV2);
router.get('/', getAllAefT2AuthorizationsV2);
router.get('/:cadTrustAefT2AuthorizationsId', getAefT2AuthorizationsV2);
router.put('/:cadTrustAefT2AuthorizationsId', updateAefT2AuthorizationsV2);
router.delete('/:cadTrustAefT2AuthorizationsId', deleteAefT2AuthorizationsV2);

export default router;
