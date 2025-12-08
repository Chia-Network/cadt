import express from 'express';
import * as VerificationV2Controller from '../../../controllers/v2/verification-v2.controller.js';

const VerificationV2Router = express.Router();

// CRUD routes for verification
VerificationV2Router.post('/', VerificationV2Controller.create);
VerificationV2Router.get('/', VerificationV2Controller.findAll);
VerificationV2Router.get('/:id', VerificationV2Controller.findOne);
VerificationV2Router.put('/:id', VerificationV2Controller.update);
VerificationV2Router.delete('/:id', VerificationV2Controller.destroy);

export { VerificationV2Router };
