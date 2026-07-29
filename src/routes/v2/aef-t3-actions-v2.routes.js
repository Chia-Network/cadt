'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createAefT3ActionsV2,
  getAefT3ActionsV2,
  getAllAefT3ActionsV2,
  updateAefT3ActionsV2,
  deleteAefT3ActionsV2,
} from '../../controllers/v2/aef-t3-actions-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const aefT3ActionsGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// AEF-T3-Actions CRUD routes
router.post('/', createAefT3ActionsV2);
router.get('/', validator.query(aefT3ActionsGetSchema), getAllAefT3ActionsV2);
router.get('/:cadTrustAefT3ActionsId', getAefT3ActionsV2);
router.put('/:cadTrustAefT3ActionsId', updateAefT3ActionsV2);
router.delete('/:cadTrustAefT3ActionsId', deleteAefT3ActionsV2);

export default router;
