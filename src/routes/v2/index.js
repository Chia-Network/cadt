import express from 'express';
import { MethodologyV2Router } from './resources/methodology-v2.js';
import { ProgramV2Router } from './resources/program-v2.js';
import { ProjectV2Router } from './resources/project-v2.js';
import { ValidationV2Router } from './resources/validation-v2.js';
import { VerificationV2Router } from './resources/verification-v2.js';
import { IssuanceV2Router } from './resources/issuance-v2.js';
import { UnitV2Router } from './resources/unit-v2.js';
import locationV2Routes from './location-v2.routes.js';

const V2Router = express.Router();

// Basic health check for V2
V2Router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'V2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// V2 API routes
V2Router.use('/methodology', MethodologyV2Router);
V2Router.use('/program', ProgramV2Router);
V2Router.use('/project', ProjectV2Router);
V2Router.use('/validation', ValidationV2Router);
V2Router.use('/verification', VerificationV2Router);
V2Router.use('/issuance', IssuanceV2Router);
V2Router.use('/unit', UnitV2Router);
V2Router.use('/location', locationV2Routes);

export { V2Router };
