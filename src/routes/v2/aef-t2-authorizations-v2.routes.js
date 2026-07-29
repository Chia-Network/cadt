'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createAefT2AuthorizationsV2,
  getAefT2AuthorizationsV2,
  getAllAefT2AuthorizationsV2,
  updateAefT2AuthorizationsV2,
  deleteAefT2AuthorizationsV2,
} from '../../controllers/v2/aef-t2-authorizations-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const aefT2AuthorizationsGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// AEF-T2-Authorizations CRUD routes
router.post('/', createAefT2AuthorizationsV2);
router.get('/', validator.query(aefT2AuthorizationsGetSchema), getAllAefT2AuthorizationsV2);
router.get('/:cadTrustAefT2AuthorizationsId', getAefT2AuthorizationsV2);
router.put('/:cadTrustAefT2AuthorizationsId', updateAefT2AuthorizationsV2);
router.delete('/:cadTrustAefT2AuthorizationsId', deleteAefT2AuthorizationsV2);

export default router;
