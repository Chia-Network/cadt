'use strict';

import express from 'express';
import Joi from 'joi';
import joiExpress from 'express-joi-validation';
import { StagingController } from '../../../controllers';

const validator = joiExpress.createValidator({});
const StagingRouter = express.Router();

StagingRouter.get('/', (req, res) => {
  return StagingController.findAll(req, res);
});

const querySchemaDelete = Joi.object({
  uuid: Joi.string().required(),
});

StagingRouter.delete(
  '/',
  validator.body(querySchemaDelete),
  StagingController.destroy,
);

StagingRouter.post('/commit', StagingController.commit);

// Empty entire stagin table
StagingRouter.delete('/clean', StagingController.clean);

export { StagingRouter };
