import CreateProjectsTable from './20211201195550-create-project.js';
import CreateUnitsTable from './20211201194652-create-unit.js';
import CreateLabelsTable from './20211201194416-create-label.js';
import CreateRelatedProjectsTable from './20211201194449-create-related-project.js';
import CreateIssuancesTable from './20211201194541-create-issuance.js';
import CreateProjectRatingsTable from './20211201194803-create-project-rating.js';
import CreateCoBenefitsTable from './20211201194914-create-co-benefit.js';
import CreateProjectLocationTable from './20211201195016-create-project-location.js';
import CreateStagingTable from './20211207145446-staging.js';
import InitFtsModule from './20211212200953-fulltext-search.js';
import CreateLabelUnitsTable from './20211215213314-label-units-junction.js';
import CreateProjectTriggers from './20211219182106-sqlite-triggers-projects.js';
import CreateUnitTriggers from './20211219184405-sqlite-triggers-units.js';
import AddOrgUidIndex from './20220115134849-add-orgUid-index.js';
import CreateSimulatorTable from './20220122141750-create-simulator-table.js';
import CreateOrganizationTable from './20220122164836-create-organization-table.js';
import CreateEstimationTable from './20220127190529-create-estimation-table.js';
import CreateAuditTable from './20220222204323-create-audit-table.js';
import CreateMetaTable from './20220119211024-create-meta-table.js';
import CreateGoveranceTable from './20220315134151-create-governance-table.js';
import AddCommentColumnToDataModelTables from './20220428144558-add-comment-column-to-all-datamodels.js';
import AddSerialNumberFields from './20220504180739-add-serial-number-fields.js';
import AddDescriptionFieldToProjects from './20220509125335-add-description-field-to-projects.js';
import RepopulateVirtualTables from './20220515223227-re-populate-virtual-tables.js';
import AddAuthorColumnToAuditTable from './20220708210357-adding-author-column-to-audit-table.js';
import CreateFileStore from './20220724212553-create-file-store.js';
import AddOptionalMethodology2FieldToProject from './20220721212845-add-optional-methodology2-field-to-project.js';
import AddFiltStoreSubscribedColumnToProject from './20220809182156-AddFileStoreSubscribedColumn.js';
import PopulateUnitsFTS from './20220808192709-populate-units-fts.js';
import ResetDBForNewSingletons from './20220816155101-reset-db-for-new-singletons.js';
import AddIsTransferColumn from './20220825124702-add-isTransfer-column.js';
import AddOrgMetadata from './20220831023546-add-org-metadata.js';
import OrgSyncStatus from './20231020201652-OrgSyncStatus.js';
import OrgSyncRemaining from './20231020214357-OrgSyncRemainingCount.js';
import AddGenerationIndexToAudit from './20231207142225-AddGenerationIndexToAudit.js';

export const migrations = [
  {
    migration: CreateProjectsTable,
    name: '20211201195550-create-project.js',
  },
  {
    migration: CreateIssuancesTable,
    name: '20211201194541-create-issuance.js',
  },
  {
    migration: CreateUnitsTable,
    name: '20211201194652-create-unit.js',
  },
  {
    migration: CreateLabelsTable,
    name: '20211201194416-create-label.js',
  },
  {
    migration: CreateRelatedProjectsTable,
    name: '20211201194449-create-related-project.js',
  },
  {
    migration: CreateProjectRatingsTable,
    name: '20211201194803-create-project-rating.js',
  },
  {
    migration: CreateCoBenefitsTable,
    name: '20211201194914-create-co-benefit.js',
  },
  {
    migration: CreateProjectLocationTable,
    name: '20211201195016-create-project-location.js',
  },
  {
    migration: CreateStagingTable,
    name: '20211212200953-fulltext-search.js',
  },
  {
    migration: CreateLabelUnitsTable,
    name: '20211215213314-label-units-junction.js',
  },
  {
    migration: CreateLabelUnitsTable,
    name: '20211215213314-label-units-junction.js',
  },
  {
    migration: CreateSimulatorTable,
    name: '20220122141750-create-simulator-table.js',
  },
  {
    migration: CreateOrganizationTable,
    name: '20220122164836-create-organization-table.js',
  },
  {
    migration: CreateEstimationTable,
    name: '20220127190529-create-estimation-table.js',
  },
  {
    migration: CreateAuditTable,
    name: '20220222204323-create-audit-table.js',
  },
  {
    migration: CreateMetaTable,
    name: '20220119211024-create-meta-table.js',
  },
  {
    migration: InitFtsModule,
    name: '20211201195016-create-project-location.js',
  },
  {
    migration: CreateProjectTriggers,
    name: '20211219182106-sqlite-triggers-projects.js',
  },
  {
    migration: CreateUnitTriggers,
    name: '20211219184405-sqlite-triggers-units.js',
  },
  {
    migration: AddOrgUidIndex,
    name: '20220115134849-add-orgUid-index.js',
  },
  {
    migration: CreateGoveranceTable,
    name: '20220315134151-create-governance-table.js',
  },
  {
    migration: AddCommentColumnToDataModelTables,
    name: '20220428144558-add-comment-column-to-all-datamodels.js',
  },
  {
    migration: AddSerialNumberFields,
    name: '20220504180739-add-serial-number-fields.js',
  },
  {
    migration: AddDescriptionFieldToProjects,
    name: '20220509125335-add-description-field-to-projects.js',
  },
  {
    migration: RepopulateVirtualTables,
    name: '20220515223227-re-populate-virtual-tables.js',
  },
  {
    migration: AddAuthorColumnToAuditTable,
    name: '20220708210357-adding-author-column-to-audit-table.js',
  },
  {
    migration: CreateFileStore,
    name: '20220724212553-create-file-store.js',
  },
  {
    migration: AddOptionalMethodology2FieldToProject,
    name: '20220721212845-add-optional-methodology2-field-to-project.js',
  },
  {
    migration: AddFiltStoreSubscribedColumnToProject,
    name: '20220724161782-add-file-store-subscribed-column-to-project.js',
  },
  {
    migration: PopulateUnitsFTS,
    name: '20220808192709-populate-units-fts.js',
  },
  {
    migration: ResetDBForNewSingletons,
    name: '20220816155101-reset-db-for-new-singletons.js',
  },
  {
    migration: AddIsTransferColumn,
    name: '20220825124702-add-isTransfer-column.js',
  },
  {
    migration: AddOrgMetadata,
    name: '20220831023546-add-org-metadata.js',
  },
  {
    migration: OrgSyncStatus,
    name: '20231020201652-OrgSyncStatus.js',
  },
  {
    migration: OrgSyncRemaining,
    name: '20231020214357-OrgSyncRemainingCount.js',
  },
  {
    migration: AddGenerationIndexToAudit,
    name: '20231207142225-AddGenerationIndexToAudit.js',
  },
];
