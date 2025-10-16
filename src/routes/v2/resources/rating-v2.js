import express from 'express';
import { RatingV2Controller } from '../../../controllers/v2/index.js';

const RatingV2Router = express.Router();

// Create rating
RatingV2Router.post('/', (req, res) => {
  return RatingV2Controller.create(req, res);
});

// Get all ratings
RatingV2Router.get('/', (req, res) => {
  return RatingV2Controller.findAll(req, res);
});

// Get rating by ID
RatingV2Router.get('/:id', (req, res) => {
  return RatingV2Controller.findOne(req, res);
});

// Update rating
RatingV2Router.put('/:id', (req, res) => {
  return RatingV2Controller.update(req, res);
});

// Delete rating
RatingV2Router.delete('/:id', (req, res) => {
  return RatingV2Controller.destroy(req, res);
});

export { RatingV2Router };
