'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createAefT4HoldingsV2,
  getAefT4HoldingsV2,
  getAllAefT4HoldingsV2,
  updateAefT4HoldingsV2,
  deleteAefT4HoldingsV2,
} from '../../controllers/v2/aef-t4-holdings-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const aefT4HoldingsGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// AEF-T4-Holdings CRUD routes
router.post('/', createAefT4HoldingsV2);
router.get('/', validator.query(aefT4HoldingsGetSchema), getAllAefT4HoldingsV2);
router.get('/:cadTrustAefT4HoldingsId', getAefT4HoldingsV2);
router.put('/:cadTrustAefT4HoldingsId', updateAefT4HoldingsV2);
router.delete('/:cadTrustAefT4HoldingsId', deleteAefT4HoldingsV2);

export default router;
