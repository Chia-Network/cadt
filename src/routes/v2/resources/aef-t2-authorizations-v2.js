import express from 'express';
import { AefT2AuthorizationsV2Controller } from '../../../controllers/v2/index.js';

const AefT2AuthorizationsV2Router = express.Router();

// Create aef-t2-authorizations
AefT2AuthorizationsV2Router.post('/', (req, res) => {
  return AefT2AuthorizationsV2Controller.create(req, res);
});

// Get all aef-t2-authorizations
AefT2AuthorizationsV2Router.get('/', (req, res) => {
  return AefT2AuthorizationsV2Controller.findAll(req, res);
});

// Get aef-t2-authorizations by ID
AefT2AuthorizationsV2Router.get('/:id', (req, res) => {
  return AefT2AuthorizationsV2Controller.findOne(req, res);
});

// Update aef-t2-authorizations
AefT2AuthorizationsV2Router.put('/:id', (req, res) => {
  return AefT2AuthorizationsV2Controller.update(req, res);
});

// Delete aef-t2-authorizations
AefT2AuthorizationsV2Router.delete('/:id', (req, res) => {
  return AefT2AuthorizationsV2Controller.destroy(req, res);
});

export { AefT2AuthorizationsV2Router };
