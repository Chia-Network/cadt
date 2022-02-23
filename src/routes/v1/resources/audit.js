'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

import { AuditController } from '../../../controllers';
import { auditGetSchema } from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const AuditRouter = express.Router();

AuditRouter.get('/', validator.query(auditGetSchema), (req, res) => {
  return AuditController.findAll(req, res);
});

export { AuditRouter };
