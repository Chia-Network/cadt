// V2 System Table Models
import StagingV2 from './staging-v2.model.js';
import OrganizationsV2 from './organizations-v2.model.js';
import MetaV2 from './meta-v2.model.js';
import GovernanceV2 from './governance-v2.model.js';
import AuditV2 from './audit-v2.model.js';
import AuditV2Mirror from './audit-v2.model.mirror.js';
import SimulatorV2 from './simulator-v2.model.js';

// V2 Data Table Models
import { MethodologyV2 } from './methodology-v2.model.js';
import { MethodologyV2Mirror } from './methodology-v2.model.mirror.js';
import { ProgramV2 } from './program-v2.model.js';
import { ProgramV2Mirror } from './program-v2.model.mirror.js';
import { ProjectV2 } from './project-v2.model.js';
import { ProjectV2Mirror } from './project-v2.model.mirror.js';
import { ValidationV2 } from './validation-v2.model.js';
import { ValidationV2Mirror } from './validation-v2.model.mirror.js';
import { VerificationV2 } from './verification-v2.model.js';
import { VerificationV2Mirror } from './verification-v2.model.mirror.js';
import { IssuanceV2 } from './issuance-v2.model.js';
import { IssuanceV2Mirror } from './issuance-v2.model.mirror.js';

// Set up model associations
ProgramV2.associate({ ProgramV2, ProjectV2 });
ProjectV2.associate({ ProgramV2, ProjectV2, ValidationV2 });
ValidationV2.associate({ ProjectV2, ValidationV2 });
VerificationV2.associate({ ProjectV2, ValidationV2, VerificationV2 });
IssuanceV2.associate({ VerificationV2, MethodologyV2, IssuanceV2 });

// Export all V2 models
export {
  StagingV2,
  OrganizationsV2,
  MetaV2,
  GovernanceV2,
  AuditV2,
  AuditV2Mirror,
  SimulatorV2,
  MethodologyV2,
  MethodologyV2Mirror,
  ProgramV2,
  ProgramV2Mirror,
  ProjectV2,
  ProjectV2Mirror,
  ValidationV2,
  ValidationV2Mirror,
  VerificationV2,
  VerificationV2Mirror,
  IssuanceV2,
  IssuanceV2Mirror,
};

// Default export for convenience
export default {
  StagingV2,
  OrganizationsV2,
  MetaV2,
  GovernanceV2,
  AuditV2,
  AuditV2Mirror,
  SimulatorV2,
  MethodologyV2,
  MethodologyV2Mirror,
  ProgramV2,
  ProgramV2Mirror,
  ProjectV2,
  ProjectV2Mirror,
  ValidationV2,
  ValidationV2Mirror,
  VerificationV2,
  VerificationV2Mirror,
  IssuanceV2,
  IssuanceV2Mirror,
};
