// V2 System Table Models
import StagingV2 from './staging-v2.model.js';
import OrganizationsV2 from './organizations-v2.model.js';
import OrganizationsV2Mirror from './organizations-v2.model.mirror.js';
import MetaV2 from './meta-v2.model.js';
import GovernanceV2 from './governance-v2.model.js';
import AuditV2 from './audit-v2.model.js';
import AuditV2Mirror from './audit-v2.model.mirror.js';
import SimulatorV2 from './simulator-v2.model.js';
import FilestoreV2 from './filestore-v2.model.js';
import { OfferV2 } from './offer-v2.model.js';

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
import { UnitV2 } from './unit-v2.model.js';
import { UnitV2Mirror } from './unit-v2.model.mirror.js';
import { LocationV2 } from './location-v2.model.js';
import { LocationV2Mirror } from './location-v2.model.mirror.js';
import { EstimationV2 } from './estimation-v2.model.js';
import { EstimationV2Mirror } from './estimation-v2.model.mirror.js';
import { RatingV2 } from './rating-v2.model.js';
import { RatingV2Mirror } from './rating-v2.model.mirror.js';
import { CoBenefitV2 } from './co-benefit-v2.model.js';
import { CoBenefitV2Mirror } from './co-benefit-v2.model.mirror.js';
import { ProjectMethodologyV2 } from './project-methodology-v2.model.js';
import { ProjectMethodologyV2Mirror } from './project-methodology-v2.model.mirror.js';
import { StakeholderV2 } from './stakeholder-v2.model.js';
import { StakeholderV2Mirror } from './stakeholder-v2.model.mirror.js';
import { StakeholderProjectV2 } from './stakeholder-projects-v2.model.js';
import { StakeholderProjectV2Mirror } from './stakeholder-projects-v2.model.mirror.js';
import { LabelV2 } from './label-v2.model.js';
import { LabelV2Mirror } from './label-v2.model.mirror.js';
import { UnitLabelV2 } from './unit-label-v2.model.js';
import { UnitLabelV2Mirror } from './unit-label-v2.model.mirror.js';
import { AefT1SubmissionV2 } from './aef-t1-submission-v2.model.js';
import { AefT1SubmissionV2Mirror } from './aef-t1-submission-v2.model.mirror.js';
import { AefT5AuthorizedEntitiesV2 } from './aef-t5-authorized-entities-v2.model.js';
import { AefT5AuthorizedEntitiesV2Mirror } from './aef-t5-authorized-entities-v2.model.mirror.js';
import { AefT2AuthorizationsV2 } from './aef-t2-authorizations-v2.model.js';
import { AefT2AuthorizationsV2Mirror } from './aef-t2-authorizations-v2.model.mirror.js';
import { AefT3ActionsV2 } from './aef-t3-actions-v2.model.js';
import { AefT3ActionsV2Mirror } from './aef-t3-actions-v2.model.mirror.js';
import { AefT4HoldingsV2 } from './aef-t4-holdings-v2.model.js';
import { AefT4HoldingsV2Mirror } from './aef-t4-holdings-v2.model.mirror.js';

// Set up model associations
ProgramV2.associate({ ProgramV2, ProjectV2 });
ProjectV2.associate({ ProgramV2, ProjectV2, ValidationV2, VerificationV2, LocationV2, EstimationV2, RatingV2, CoBenefitV2, ProjectMethodologyV2, StakeholderProjectV2 });
ValidationV2.associate({ ProjectV2, ValidationV2 });
VerificationV2.associate({ ProjectV2, ValidationV2, VerificationV2 });
IssuanceV2.associate({ VerificationV2, ProjectMethodologyV2, LocationV2, IssuanceV2, UnitV2 });
UnitV2.associate({ IssuanceV2, UnitV2, UnitLabelV2, AefT5AuthorizedEntitiesV2 });
LocationV2.associate({ ProjectV2, LocationV2 });
EstimationV2.associate({ ProjectV2, EstimationV2 });
RatingV2.associate({ ProjectV2, RatingV2 });
CoBenefitV2.associate({ ProjectV2, CoBenefitV2 });
ProjectMethodologyV2.associate({ ProjectV2, MethodologyV2, ProjectMethodologyV2 });
StakeholderV2.associate({ StakeholderV2, StakeholderProjectV2 });
StakeholderProjectV2.associate({ StakeholderV2, ProjectV2, StakeholderProjectV2 });
LabelV2.associate({ LabelV2, UnitLabelV2 });
UnitLabelV2.associate({ LabelV2, UnitV2, UnitLabelV2 });
AefT1SubmissionV2.associate({ AefT1SubmissionV2, AefT5AuthorizedEntitiesV2 });
AefT5AuthorizedEntitiesV2.associate({ AefT1SubmissionV2, UnitV2, ProjectV2, AefT5AuthorizedEntitiesV2, AefT2AuthorizationsV2 });
AefT2AuthorizationsV2.associate({ AefT1SubmissionV2, UnitV2, ProjectV2, AefT5AuthorizedEntitiesV2, AefT2AuthorizationsV2, AefT3ActionsV2, AefT4HoldingsV2 });
AefT3ActionsV2.associate({ AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2, AefT3ActionsV2 });
AefT4HoldingsV2.associate({ AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2, AefT4HoldingsV2 });

// Export all V2 models
export {
  StagingV2,
  OrganizationsV2,
  OrganizationsV2Mirror,
  MetaV2,
  GovernanceV2,
  AuditV2,
  AuditV2Mirror,
  SimulatorV2,
  FilestoreV2,
  OfferV2,
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
  UnitV2,
  UnitV2Mirror,
  LocationV2,
  LocationV2Mirror,
  EstimationV2,
  EstimationV2Mirror,
  RatingV2,
  RatingV2Mirror,
  CoBenefitV2,
  CoBenefitV2Mirror,
  ProjectMethodologyV2,
  ProjectMethodologyV2Mirror,
  StakeholderV2,
  StakeholderV2Mirror,
  StakeholderProjectV2,
  StakeholderProjectV2Mirror,
  LabelV2,
  LabelV2Mirror,
  UnitLabelV2,
  UnitLabelV2Mirror,
  AefT1SubmissionV2,
  AefT1SubmissionV2Mirror,
  AefT5AuthorizedEntitiesV2,
  AefT5AuthorizedEntitiesV2Mirror,
  AefT2AuthorizationsV2,
  AefT2AuthorizationsV2Mirror,
  AefT3ActionsV2,
  AefT3ActionsV2Mirror,
  AefT4HoldingsV2,
  AefT4HoldingsV2Mirror,
};

// Default export for convenience
export default {
  StagingV2,
  OrganizationsV2,
  OrganizationsV2Mirror,
  MetaV2,
  GovernanceV2,
  AuditV2,
  AuditV2Mirror,
  SimulatorV2,
  FilestoreV2,
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
  UnitV2,
  UnitV2Mirror,
  LocationV2,
  LocationV2Mirror,
  EstimationV2,
  EstimationV2Mirror,
  RatingV2,
  RatingV2Mirror,
  CoBenefitV2,
  CoBenefitV2Mirror,
  ProjectMethodologyV2,
  ProjectMethodologyV2Mirror,
  StakeholderV2,
  StakeholderV2Mirror,
  StakeholderProjectV2,
  StakeholderProjectV2Mirror,
  LabelV2,
  LabelV2Mirror,
  UnitLabelV2,
  UnitLabelV2Mirror,
  AefT1SubmissionV2,
  AefT1SubmissionV2Mirror,
  AefT5AuthorizedEntitiesV2,
  AefT5AuthorizedEntitiesV2Mirror,
  AefT2AuthorizationsV2,
  AefT2AuthorizationsV2Mirror,
  AefT3ActionsV2,
  AefT3ActionsV2Mirror,
  AefT4HoldingsV2,
  AefT4HoldingsV2Mirror,
};
