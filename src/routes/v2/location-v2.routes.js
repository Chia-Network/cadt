import express from 'express';
import locationController from '../../controllers/v2/location-v2.controller.js';

const router = express.Router();

// Location CRUD routes
router.post('/', locationController.create);
router.get('/', locationController.findAll);
router.get('/:id', locationController.findOne);
router.put('/:id', locationController.update);
router.delete('/:id', locationController.delete);

export default router;
