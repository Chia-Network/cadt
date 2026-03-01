import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import locationController from '../../controllers/v2/location-v2.controller.js';
import { paginationSchema } from '../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const router = express.Router();

const locationGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// Location CRUD routes
router.post('/', locationController.create);
router.get('/', validator.query(locationGetSchema), locationController.findAll);
router.get('/:id', locationController.findOne);
router.put('/:id', locationController.update);
router.delete('/:id', locationController.delete);

export default router;
