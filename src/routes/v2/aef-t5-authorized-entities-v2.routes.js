'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import {
  createAefT5AuthorizedEntitiesV2,
  getAefT5AuthorizedEntitiesV2,
  getAllAefT5AuthorizedEntitiesV2,
  updateAefT5AuthorizedEntitiesV2,
  deleteAefT5AuthorizedEntitiesV2,
} from '../../controllers/v2/aef-t5-authorized-entities-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const aefT5AuthorizedEntitiesGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// AEF-T5-Authorized-Entities CRUD routes
router.post('/', createAefT5AuthorizedEntitiesV2);
router.get('/', validator.query(aefT5AuthorizedEntitiesGetSchema), getAllAefT5AuthorizedEntitiesV2);
router.get('/:cadTrustAefT5AuthorizedEntitiesId', getAefT5AuthorizedEntitiesV2);
router.put('/:cadTrustAefT5AuthorizedEntitiesId', updateAefT5AuthorizedEntitiesV2);
router.delete('/:cadTrustAefT5AuthorizedEntitiesId', deleteAefT5AuthorizedEntitiesV2);

export default router;
