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
};
