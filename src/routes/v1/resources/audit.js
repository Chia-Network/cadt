'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

import { AuditController } from '../../../controllers';
import {
  auditGetSchema,
  auditResetToDateSchema,
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
  '/resetToDate',
  validator.body(auditResetToDateSchema),
  (req, res) => {
    return AuditController.resetToDate(req, res);
  },
);

export { AuditRouter };
