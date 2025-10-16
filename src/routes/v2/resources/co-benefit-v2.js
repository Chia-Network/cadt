import express from 'express';
import { CoBenefitV2Controller } from '../../../controllers/v2/index.js';

const CoBenefitV2Router = express.Router();

// Create co-benefit
CoBenefitV2Router.post('/', (req, res) => {
  return CoBenefitV2Controller.create(req, res);
});

// Get all co-benefits
CoBenefitV2Router.get('/', (req, res) => {
  return CoBenefitV2Controller.findAll(req, res);
});

// Get co-benefit by ID
CoBenefitV2Router.get('/:id', (req, res) => {
  return CoBenefitV2Controller.findOne(req, res);
});

// Update co-benefit
CoBenefitV2Router.put('/:id', (req, res) => {
  return CoBenefitV2Controller.update(req, res);
});

// Delete co-benefit
CoBenefitV2Router.delete('/:id', (req, res) => {
  return CoBenefitV2Controller.destroy(req, res);
});

export { CoBenefitV2Router };
