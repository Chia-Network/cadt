'use strict';

import express from 'express';
import {
  createAefT5AuthorizedEntitiesV2,
  getAefT5AuthorizedEntitiesV2,
  getAllAefT5AuthorizedEntitiesV2,
  updateAefT5AuthorizedEntitiesV2,
  deleteAefT5AuthorizedEntitiesV2,
} from '../../controllers/v2/aef-t5-authorized-entities-v2.controller.js';

const router = express.Router();

// AEF-T5-Authorized-Entities CRUD routes
router.post('/', createAefT5AuthorizedEntitiesV2);
router.get('/', getAllAefT5AuthorizedEntitiesV2);
router.get('/:cadTrustAefT5AuthorizedEntitiesId', getAefT5AuthorizedEntitiesV2);
router.put('/:cadTrustAefT5AuthorizedEntitiesId', updateAefT5AuthorizedEntitiesV2);
router.delete('/:cadTrustAefT5AuthorizedEntitiesId', deleteAefT5AuthorizedEntitiesV2);

export default router;
