import CreateProjectsTable from './20211201195550-create-project';
import CreateUnitsTable from './20211201194652-create-unit';
import CreateLabelsTable from './20211201194416-create-label';
import CreateRelatedProjectsTable from './20211201194449-create-related-project';
import CreateIssuancesTable from './20211201194541-create-issuance';
import CreateProjectRatingsTable from './20211201194803-create-project-rating';
import CreateCoBenefitsTable from './20211201194914-create-co-benefit';
import CreateProjectLocationTable from './20211201195016-create-project-location';
import CreateStagingTable from './20211207145446-staging';
import InitFtsModule from './20211212200953-fulltext-search';
import CreateLabelUnitsTable from './20211215213314-label-units-junction';
import CreateProjectTriggers from './20211219182106-sqlite-triggers-projects';
import CreateUnitTriggers from './20211219184405-sqlite-triggers-units';
import AddOrgUidIndex from './20220115134849-add-orgUid-index';
import CreateSimulatorTable from './20220122141750-create-simulator-table';
import CreateOrganizationTable from './20220122164836-create-organization-table';
import CreateEstimationTable from './20220127190529-create-estimation-table';
import CreateAuditTable from './20220222204323-create-audit-table';
import CreateMetaTable from './20220119211024-create-meta-table';
import CreateGoveranceTable from './20220315134151-create-governance-table';
import AddCommentColumnToDataModelTables from './20220428144558-add-comment-column-to-all-datamodels';
import AddSerialNumberFields from './20220504180739-add-serial-number-fields';
import AddDescriptionFieldToProjects from './20220509125335-add-description-field-to-projects';
import RepopulateVirtualTables from './20220515223227-re-populate-virtual-tables';
import AddAuthorColumnToAuditTable from './20220708210357-adding-author-column-to-audit-table';
import CreateFileStore from './20220724212553-create-file-store';
import AddOptionalMethodology2FieldToProject from './20220721212845-add-optional-methodology2-field-to-project';
import AddFiltStoreSubscribedColumnToProject from './20220809182156-AddFileStoreSubscribedColumn';
import PopulateUnitsFTS from './20220808192709-populate-units-fts';
import ResetDBForNewSingletons from './20220816155101-reset-db-for-new-singletons';
import AddIsTransferColumn from './20220825124702-add-isTransfer-column';
import AddOrgMetadata from './20220831023546-add-org-metadata';
import AddPrefix from './20230824175347-add-prefix';
import OrgSyncStatus from './20231020201652-OrgSyncStatus';
import OrgSyncRemaining from './20231020214357-OrgSyncRemainingCount';
import UnitOwnerNotRequired from './20231016190739-UnitOwnerNotRequired';
import AddGenerationIndexToAudit from './20231207142225-AddGenerationIndexToAudit';
import CreateStatisticsCache from './20240607005647-create-statistics-cache.js';
import AddDataModelVersionStoreToOrganizationTable from './20241211153456-add-data-model-version-store-to-organization-table.js';
import CreateAddressBook from './20241127214244-create-address-book.js';

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
    name: '20220315134151-create-governance-table',
  },
  {
    migration: AddCommentColumnToDataModelTables,
    name: '20220428144558-add-comment-column-to-all-datamodels',
  },
  {
    migration: AddSerialNumberFields,
    name: '20220504180739-add-serial-number-fields.js',
  },
  {
    migration: AddDescriptionFieldToProjects,
    name: '20220509125335-add-description-field-to-projects',
  },
  {
    migration: RepopulateVirtualTables,
    name: '20220515223227-re-populate-virtual-tables',
  },
  {
    migration: AddAuthorColumnToAuditTable,
    name: '20220708210357-adding-author-column-to-audit-table',
  },
  {
    migration: CreateFileStore,
    name: '20220724212553-create-file-store',
  },
  {
    migration: AddOptionalMethodology2FieldToProject,
    name: '20220721212845-add-optional-methodology2-field-to-project',
  },
  {
    migration: AddFiltStoreSubscribedColumnToProject,
    name: '20220724161782-add-file-store-subscribed-column-to-project',
  },
  {
    migration: PopulateUnitsFTS,
    name: '20220808192709-populate-units-fts',
  },
  {
    migration: ResetDBForNewSingletons,
    name: '20220816155101-reset-db-for-new-singletons',
  },
  {
    migration: AddIsTransferColumn,
    name: '20220825124702-add-isTransfer-column',
  },
  {
    migration: AddOrgMetadata,
    name: '20220831023546-add-org-metadata',
  },
  {
    migration: AddPrefix,
    name: '20230824175347-add-prefix',
  },
  {
    migration: OrgSyncStatus,
    name: '20231020201652-OrgSyncStatus',
  },
  {
    migration: OrgSyncRemaining,
    name: '20231020214357-OrgSyncRemainingCount',
  },
  {
    migration: UnitOwnerNotRequired,
    name: '20231016190739-UnitOwnerNotRequired',
  },
  {
    migration: AddGenerationIndexToAudit,
    name: '20231207142225-AddGenerationIndexToAudit',
  },
  {
    migration: CreateStatisticsCache,
    name: '20240607005647-create-statistics-cache',
  },
  {
    migration: AddDataModelVersionStoreToOrganizationTable,
    name: '20241211153456-add-data-model-version-store-to-organization-table',
  },
  {
    migration: CreateAddressBook,
    name: '20241127214244-create-address-book.js',
  },
];
