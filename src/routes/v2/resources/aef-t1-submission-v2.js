import express from 'express';
import { AefT1SubmissionV2Controller } from '../../../controllers/v2/index.js';

const AefT1SubmissionV2Router = express.Router();

// Create aef-t1-submission
AefT1SubmissionV2Router.post('/', (req, res) => {
  return AefT1SubmissionV2Controller.create(req, res);
});

// Get all aef-t1-submissions
AefT1SubmissionV2Router.get('/', (req, res) => {
  return AefT1SubmissionV2Controller.findAll(req, res);
});

// Get aef-t1-submission by ID
AefT1SubmissionV2Router.get('/:id', (req, res) => {
  return AefT1SubmissionV2Controller.findOne(req, res);
});

// Update aef-t1-submission
AefT1SubmissionV2Router.put('/:id', (req, res) => {
  return AefT1SubmissionV2Controller.update(req, res);
});

// Delete aef-t1-submission
AefT1SubmissionV2Router.delete('/:id', (req, res) => {
  return AefT1SubmissionV2Controller.destroy(req, res);
});

export { AefT1SubmissionV2Router };
