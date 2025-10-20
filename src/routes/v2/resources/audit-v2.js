'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import { AuditV2Controller } from '../../../controllers/v2/audit-v2.controller.js';
import { auditGetSchema, auditResetToGenerationSchema } from '../../../validations/index.js';

const validator = joiExpress.createValidator({ passError: true });
const AuditV2Router = express.Router();

AuditV2Router.get('/', validator.query(auditGetSchema), (req, res) => {
  return AuditV2Controller.findAll(req, res);
});

AuditV2Router.get('/conflicts', (req, res) => {
  return AuditV2Controller.findConflicts(req, res);
});

AuditV2Router.post('/reset', validator.body(auditResetToGenerationSchema), (req, res) => {
  return AuditV2Controller.resetToGeneration(req, res);
});

AuditV2Router.get('/latest-generation', (req, res) => {
  return AuditV2Controller.getLatestGeneration(req, res);
});

AuditV2Router.get('/generation-stats', (req, res) => {
  return AuditV2Controller.getGenerationStats(req, res);
});

export { AuditV2Router };
