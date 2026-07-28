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
import CreateUnitV2 from './20250110120012-create-unit-v2.js';
import CreateLocationV2 from './20250110120013-create-location-v2.js';
import CreateEstimationV2 from './20250110120014-create-estimation-v2.js';
import CreateRatingV2 from './20250110120015-create-rating-v2.js';
import CreateCoBenefitV2 from './20250110120016-create-co-benefit-v2.js';
import CreateProjectMethodologyV2 from './20250110120017-create-project-methodology-v2.js';
import CreateStakeholderV2 from './20250110120018-create-stakeholder-v2.js';
import CreateStakeholderProjectsV2 from './20250110120019-create-stakeholder-projects-v2.js';
import CreateLabelV2 from './20250110120020-create-label-v2.js';
import CreateUnitLabelV2 from './20250110120021-create-unit-label-v2.js';
import CreateAefT1SubmissionV2 from './20250110120022-create-aef-t1-submission-v2.js';
import CreateAefT5AuthorizedEntitiesV2 from './20250110120023-create-aef-t5-authorized-entities-v2.js';
import CreateAefT2AuthorizationsV2 from './20250110120024-create-aef-t2-authorizations-v2.js';
import CreateAefT3ActionsV2 from './20250110120025-create-aef-t3-actions-v2.js';
import CreateAefT4HoldingsV2 from './20250110120026-create-aef-t4-holdings-v2.js';

// V2 System Table Migrations (continued)
import CreateFilestoreV2 from './20250110120030-create-filestore-v2.js';

// V2 FTS5 Migrations
import CreateFts5TablesV2 from './20250110120031-create-fts5-tables-v2.js';
import CreateFts5TriggersV2 from './20250110120032-create-fts5-triggers-v2.js';

// V2 Data Table Alterations
import RenameIssuanceMethodologyToProjectMethodologyV2 from './20250110120034-rename-issuance-methodology-to-project-methodology-v2.js';

// V2 Corrective Migrations
import FixLongAefIndexNamesV2 from './20250212120000-fix-long-aef-index-names-v2.js';
import DropGovernanceFromMirrorV2 from './20250219120000-drop-governance-from-mirror-v2.js';

// V2 Owner Field Migration
import AddOrgUidToStandaloneTablesV2 from './20260220120000-add-org-uid-to-standalone-tables-v2.js';

// V2 Sync Performance: composite audit indexes for the per-tick generation lookup
import AddAuditSyncIndexesV2 from './20260301120000-add-audit-sync-indexes-v2.js';

// V2 Audit list endpoint: composite index covering per-org time-ordered pagination
import AddAuditListIndexV2 from './20260615120000-add-audit-list-index-v2.js';

// V2 corrective migration: repair stale issuance schemas missing project methodology
import RepairIssuanceProjectMethodologyColumnV2 from './20260629133000-repair-issuance-project-methodology-column-v2.js';

// V2 AEF Field Name Corrections
import RenameAefCooperativeApproachColumnsV2 from './20260629210000-rename-aef-cooperative-approach-columns-v2.js';

// V2 Creator Provenance Field
import AddCreatedByOrgUidV2 from './20260727120000-add-created-by-org-uid-v2.js';

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
  {
    migration: CreateUnitV2,
    name: '20250110120012-create-unit-v2',
  },
  {
    migration: CreateLocationV2,
    name: '20250110120013-create-location-v2',
  },
  {
    migration: CreateEstimationV2,
    name: '20250110120014-create-estimation-v2',
  },
  {
    migration: CreateRatingV2,
    name: '20250110120015-create-rating-v2',
  },
  {
    migration: CreateCoBenefitV2,
    name: '20250110120016-create-co-benefit-v2',
  },
  {
    migration: CreateProjectMethodologyV2,
    name: '20250110120017-create-project-methodology-v2',
  },
  {
    migration: CreateStakeholderV2,
    name: '20250110120018-create-stakeholder-v2',
  },
  {
    migration: CreateStakeholderProjectsV2,
    name: '20250110120019-create-stakeholder-projects-v2',
  },
  {
    migration: CreateLabelV2,
    name: '20250110120020-create-label-v2',
  },
  {
    migration: CreateUnitLabelV2,
    name: '20250110120021-create-unit-label-v2',
  },
  {
    migration: CreateAefT1SubmissionV2,
    name: '20250110120022-create-aef-t1-submission-v2',
  },
  {
    migration: CreateAefT5AuthorizedEntitiesV2,
    name: '20250110120023-create-aef-t5-authorized-entities-v2',
  },
  {
    migration: CreateAefT2AuthorizationsV2,
    name: '20250110120024-create-aef-t2-authorizations-v2',
  },
  {
    migration: CreateAefT3ActionsV2,
    name: '20250110120025-create-aef-t3-actions-v2',
  },
  {
    migration: CreateAefT4HoldingsV2,
    name: '20250110120026-create-aef-t4-holdings-v2',
  },
  {
    migration: CreateFilestoreV2,
    name: '20250110120030-create-filestore-v2',
  },
  {
    migration: CreateFts5TablesV2,
    name: '20250110120031-create-fts5-tables-v2',
  },
  {
    migration: CreateFts5TriggersV2,
    name: '20250110120032-create-fts5-triggers-v2',
  },
  {
    migration: RenameIssuanceMethodologyToProjectMethodologyV2,
    name: '20250110120034-rename-issuance-methodology-to-project-methodology-v2',
  },
  {
    migration: FixLongAefIndexNamesV2,
    name: '20250212120000-fix-long-aef-index-names-v2',
  },
  {
    migration: DropGovernanceFromMirrorV2,
    name: '20250219120000-drop-governance-from-mirror-v2',
  },
  {
    migration: AddOrgUidToStandaloneTablesV2,
    name: '20260220120000-add-org-uid-to-standalone-tables-v2',
  },
  {
    migration: AddAuditSyncIndexesV2,
    name: '20260301120000-add-audit-sync-indexes-v2',
  },
  {
    migration: AddAuditListIndexV2,
    name: '20260615120000-add-audit-list-index-v2',
  },
  {
    migration: RepairIssuanceProjectMethodologyColumnV2,
    name: '20260629133000-repair-issuance-project-methodology-column-v2',
  },
  {
    migration: RenameAefCooperativeApproachColumnsV2,
    name: '20260629210000-rename-aef-cooperative-approach-columns-v2',
  },
  {
    migration: AddCreatedByOrgUidV2,
    name: '20260727120000-add-created-by-org-uid-v2',
  },
];
