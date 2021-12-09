'use strict';

import express from 'express';
import { StagingController } from './staging./../../controllers';
import Joi from 'joi';
import joiExpress from 'express-joi-validation';
import { StagingController } from '../../../controllers';

const validator = joiExpress.createValidator({});
const StagingRouter = express.Router();

StagingRouter.get('/', (req, res) => {
  return StagingController.findAll(req, res);
});

const querySchemaDelete = {
  id: Joi.string().required(),
};

StagingRouter.delete(
  '/',
  validator.body(querySchemaDelete),
  StagingController.destroy,
);

export { StagingRouter };
