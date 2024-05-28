'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

import { AuditController } from '../../../controllers';
import {
  auditGetSchema,
  auditResetToTimestampSchema,
  auditResetToGenerationSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const AuditRouter = express.Router();

AuditRouter.get('/', validator.query(auditGetSchema), (req, res) => {
  return AuditController.findAll(req, res);
});

AuditRouter.get('/findConflicts', (req, res) => {
  return AuditController.findConflicts(req, res);
});

AuditRouter.post(
  '/resetToGeneration',
  validator.body(auditResetToGenerationSchema),
  (req, res) => {
    return AuditController.resetToGeneration(req, res);
  },
);

AuditRouter.post(
  '/resetToTimestamp',
  validator.body(auditResetToTimestampSchema),
  (req, res) => {
    return AuditController.resetToTimestamp(req, res);
  },
);

export { AuditRouter };
