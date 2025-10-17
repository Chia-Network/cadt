import express from 'express';
import * as ResourceRouters from './resources/index.js';

const V2Router = express.Router();

// Mount resource routes
V2Router.use('/project', ResourceRouters.ProjectV2Router);
V2Router.use('/organizations', ResourceRouters.OrganizationsV2Router);
V2Router.use('/governance', ResourceRouters.GovernanceV2Router);
V2Router.use('/validation', ResourceRouters.ValidationV2Router);
V2Router.use('/verification', ResourceRouters.VerificationV2Router);
V2Router.use('/issuance', ResourceRouters.IssuanceV2Router);
V2Router.use('/unit', ResourceRouters.UnitV2Router);
V2Router.use('/methodology', ResourceRouters.MethodologyV2Router);
V2Router.use('/project-methodology', ResourceRouters.ProjectMethodologyV2Router);
V2Router.use('/location', ResourceRouters.LocationV2Router);
V2Router.use('/stakeholder', ResourceRouters.StakeholderV2Router);
V2Router.use('/stakeholder-projects', ResourceRouters.StakeholderProjectsV2Router);
V2Router.use('/label', ResourceRouters.LabelV2Router);
V2Router.use('/unit-label', ResourceRouters.UnitLabelV2Router);
V2Router.use('/co-benefit', ResourceRouters.CoBenefitV2Router);
V2Router.use('/estimation', ResourceRouters.EstimationV2Router);
V2Router.use('/rating', ResourceRouters.RatingV2Router);
V2Router.use('/program', ResourceRouters.ProgramV2Router);
V2Router.use('/aef-t1-submission', ResourceRouters.AefT1SubmissionV2Router);
V2Router.use('/aef-t2-authorizations', ResourceRouters.AefT2AuthorizationsV2Router);
V2Router.use('/aef-t3-actions', ResourceRouters.AefT3ActionsV2Router);
V2Router.use('/aef-t4-holdings', ResourceRouters.AefT4HoldingsV2Router);
V2Router.use('/aef-t5-authorized-entities', ResourceRouters.AefT5AuthorizedEntitiesV2Router);

// Mount offer routes
V2Router.use('/offer', ResourceRouters.OfferV2Router);

export { V2Router };
