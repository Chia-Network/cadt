'use strict';

import express from 'express';
const V1Router = express.Router();

import { ProjectRouter, UnitRouter, StagingRouter } from './resources';

V1Router.use('/projects', ProjectRouter);
V1Router.use('/units', UnitRouter);
V1Router.use('/staging', StagingRouter);

export { V1Router };
