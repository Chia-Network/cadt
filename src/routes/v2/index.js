import express from 'express';
import { getWalletHealthResponse } from '../wallet-health.js';
import { getConfigV2 } from '../../utils/config-loader';
import { MethodologyV2Router } from './resources/methodology-v2.js';
import { ProgramV2Router } from './resources/program-v2.js';
import { ProjectV2Router } from './resources/project-v2.js';
import { ValidationV2Router } from './resources/validation-v2.js';
import { VerificationV2Router } from './resources/verification-v2.js';
import { IssuanceV2Router } from './resources/issuance-v2.js';
import { UnitV2Router } from './resources/unit-v2.js';
import { GovernanceV2Router } from './resources/governance-v2.js';
import locationV2Routes from './location-v2.routes.js';
import estimationV2Routes from './estimation-v2.routes.js';
import ratingV2Routes from './rating-v2.routes.js';
import coBenefitV2Routes from './co-benefit-v2.routes.js';
import projectMethodologyV2Routes from './project-methodology-v2.routes.js';
import stakeholderV2Routes from './stakeholder-v2.routes.js';
import stakeholderProjectsV2Routes from './stakeholder-projects-v2.routes.js';
import labelV2Routes from './label-v2.routes.js';
import unitLabelV2Routes from './unit-label-v2.routes.js';
import aefT1SubmissionV2Routes from './aef-t1-submission-v2.routes.js';
import aefT5AuthorizedEntitiesV2Routes from './aef-t5-authorized-entities-v2.routes.js';
import aefT2AuthorizationsV2Routes from './aef-t2-authorizations-v2.routes.js';
import aefT3ActionsV2Routes from './aef-t3-actions-v2.routes.js';
import aefT4HoldingsV2Routes from './aef-t4-holdings-v2.routes.js';
import { StagingV2Router } from './resources/staging-v2.js';
import { OrganizationsV2Router } from './resources/organizations-v2.js';
import { AuditV2Router } from './resources/audit-v2.js';
import { OfferV2Router } from './resources/offer-v2.js';
import { FilestoreV2Router } from './resources/filestore-v2.js';

const V2Router = express.Router();

V2Router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'V2 API is running',
    timestamp: new Date().toISOString(),
  });
});

V2Router.get('/health/wallet', async (req, res) => {
  try {
    const wallet = (await import('../../datalayer/wallet.js')).default;
    const config = getConfigV2();
    const result = await getWalletHealthResponse(wallet, {
      readOnly: config.READ_ONLY || false,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(200).json({
      synced: false,
      error: `Wallet health check failed: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// V2 API routes
V2Router.use('/methodology', MethodologyV2Router);
V2Router.use('/program', ProgramV2Router);
V2Router.use('/project', ProjectV2Router);
V2Router.use('/validation', ValidationV2Router);
V2Router.use('/verification', VerificationV2Router);
V2Router.use('/issuance', IssuanceV2Router);
V2Router.use('/unit', UnitV2Router);
V2Router.use('/governance', GovernanceV2Router);
V2Router.use('/location', locationV2Routes);
V2Router.use('/estimation', estimationV2Routes);
V2Router.use('/rating', ratingV2Routes);
V2Router.use('/co-benefit', coBenefitV2Routes);
V2Router.use('/project-methodology', projectMethodologyV2Routes);
V2Router.use('/stakeholder', stakeholderV2Routes);
V2Router.use('/stakeholder-projects', stakeholderProjectsV2Routes);
V2Router.use('/label', labelV2Routes);
V2Router.use('/unit-label', unitLabelV2Routes);
V2Router.use('/aef-t1-submission', aefT1SubmissionV2Routes);
V2Router.use('/aef-t5-authorized-entities', aefT5AuthorizedEntitiesV2Routes);
V2Router.use('/aef-t2-authorizations', aefT2AuthorizationsV2Routes);
V2Router.use('/aef-t3-actions', aefT3ActionsV2Routes);
V2Router.use('/aef-t4-holdings', aefT4HoldingsV2Routes);
V2Router.use('/staging', StagingV2Router);
V2Router.use('/organizations', OrganizationsV2Router);
V2Router.use('/audit', AuditV2Router);
V2Router.use('/offer', OfferV2Router);
V2Router.use('/filestore', FilestoreV2Router);

export { V2Router };
