'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import * as AuditV2Controller from '../../../controllers/v2/audit-v2.controller.js';
import {
  auditGetSchema,
  auditResetToDateSchema,
  auditResetToGenerationSchema,
} from '../../../validations/audit.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const AuditV2Router = express.Router();

// GET /v2/audit - Get audit history with pagination
AuditV2Router.get('/', validator.query(auditGetSchema), (req, res) => {
  return AuditV2Controller.findAll(req, res);
});

// GET /v2/audit/findConflicts - Find conflicts in audit history
AuditV2Router.get('/findConflicts', (req, res) => {
  return AuditV2Controller.findConflicts(req, res);
});

// POST /v2/audit/resetToGeneration - Reset to generation
AuditV2Router.post(
  '/resetToGeneration',
  validator.body(auditResetToGenerationSchema),
  (req, res) => {
    return AuditV2Controller.resetToGeneration(req, res);
  },
);

// POST /v2/audit/resetToDate - Reset to date
AuditV2Router.post(
  '/resetToDate',
  validator.body(auditResetToDateSchema),
  (req, res) => {
    return AuditV2Controller.resetToDate(req, res);
  },
);

export { AuditV2Router };

