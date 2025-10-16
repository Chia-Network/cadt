import express from 'express';
import * as ResourceRouters from './resources/index.js';

const V2Router = express.Router();

// Mount resource routes
V2Router.use('/project', ResourceRouters.ProjectV2Router);
V2Router.use('/organizations', ResourceRouters.OrganizationsV2Router);
V2Router.use('/governance', ResourceRouters.GovernanceV2Router);

export { V2Router };
