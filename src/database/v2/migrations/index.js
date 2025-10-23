// V2 System Table Migrations
import CreateStagingV2 from './20250110120000-create-staging-v2.js';
import CreateAuditV2 from './20250110120001-create-audit-v2.js';
import CreateOrganizationsV2 from './20250110120002-create-organizations-v2.js';
import CreateMetaV2 from './20250110120003-create-meta-v2.js';
import CreateGovernanceV2 from './20250110120004-create-governance-v2.js';
import CreateSimulatorV2 from './20250110120005-create-simulator-v2.js';

// V2 Data Table Migrations
import CreateMethodologyV2 from './20250110120006-create-methodology-v2.js';
import CreateProgramV2 from './20250110120007-create-program-v2.js';
import CreateProjectV2 from './20250110120008-create-project-v2.js';
import CreateValidationV2 from './20250110120009-create-validation-v2.js';
import CreateVerificationV2 from './20250110120010-create-verification-v2.js';
import CreateIssuanceV2 from './20250110120011-create-issuance-v2.js';

export const migrations = [
  {
    migration: CreateStagingV2,
    name: '20250110120000-create-staging-v2',
  },
  {
    migration: CreateAuditV2,
    name: '20250110120001-create-audit-v2',
  },
  {
    migration: CreateOrganizationsV2,
    name: '20250110120002-create-organizations-v2',
  },
  {
    migration: CreateMetaV2,
    name: '20250110120003-create-meta-v2',
  },
  {
    migration: CreateGovernanceV2,
    name: '20250110120004-create-governance-v2',
  },
  {
    migration: CreateSimulatorV2,
    name: '20250110120005-create-simulator-v2',
  },
  {
    migration: CreateMethodologyV2,
    name: '20250110120006-create-methodology-v2',
  },
  {
    migration: CreateProgramV2,
    name: '20250110120007-create-program-v2',
  },
  {
    migration: CreateProjectV2,
    name: '20250110120008-create-project-v2',
  },
  {
    migration: CreateValidationV2,
    name: '20250110120009-create-validation-v2',
  },
  {
    migration: CreateVerificationV2,
    name: '20250110120010-create-verification-v2',
  },
  {
    migration: CreateIssuanceV2,
    name: '20250110120011-create-issuance-v2',
  },
];
