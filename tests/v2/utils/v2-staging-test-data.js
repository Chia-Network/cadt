/**
 * V2 Staging Test Data Generators
 *
 * Comprehensive test data generators for all 21 V2 data models.
 * These generators create realistic test data with valid picklist values
 * and proper foreign key relationships for staging operations.
 */

import { v4 as uuidv4 } from 'uuid';
import { getRandomPicklistValue, initializePicklists } from './v2-picklist-test-helpers.js';

// Initialize picklists on module load
let picklistsInitialized = false;
const ensurePicklistsInitialized = async () => {
  if (!picklistsInitialized) {
    await initializePicklists();
    picklistsInitialized = true;
  }
};

/**
 * Generate UUID v4
 */
export const generateUuid = () => uuidv4();

/**
 * Generate a timestamp string for dates
 */
const generateDate = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
};

/**
 * Generate a year value
 */
const generateYear = (offsetYears = 0) => {
  return new Date().getFullYear() + offsetYears;
};

/**
 * Individual Model Generators
 * All generators use snake_case field names and return data objects
 * that can be used directly in staging operations.
 */

// Core Models
export const generateV2ProgramData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_program_id: generateUuid(),
    program_name: `Test Program ${Date.now()}`,
    program_registry: 'Test Registry',
    program_registry_activity_id: `ACT-${Date.now()}`,
    program_registry_program_id: `PROG-${Date.now()}`,
    program_description: 'Test program description for staging operations',
    ...overrides,
  };
};

export const generateV2MethodologyData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_methodology_id: generateUuid(),
    methodology_code: `TEST-METHOD-${Date.now()}`,
    methodology_name: 'Test Methodology',
    methodology_version: '1.0',
    methodology_date: generateDate(),
    methodology_link: 'https://example.com/methodology',
    methodology_type: getRandomPicklistValue('methodologyType') || 'CDM',
    ...overrides,
  };
};

export const generateV2ProjectData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_project_id: generateUuid(),
    project_registry_name: 'Test Registry',
    project_id: `TEST-PROJECT-${Date.now()}`,
    project_crediting_program: 'Test Crediting Program',
    project_name: 'Test Project',
    project_link: 'https://example.com/project',
    project_description: 'Test project description',
    project_sector: getRandomPicklistValue('projectSector') || 'Energy',
    project_type: getRandomPicklistValue('projectType') || 'Renewable Energy',
    project_subtype: 'Solar',
    project_status: getRandomPicklistValue('projectStatus') || 'Active',
    project_status_date: generateDate(),
    project_unit_metric: getRandomPicklistValue('projectUnitMetric') || 'tCO2e',
    cad_trust_reference_project_id: `REF-${Date.now()}`,
    ...overrides,
  };
};

export const generateV2ValidationData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_validation_id: generateUuid(),
    validation_id: `VALIDATION-${Date.now()}`,
    validation_type: getRandomPicklistValue('validationType') || 'Initial',
    validation_body: getRandomPicklistValue('validationBody') || 'Test VVB',
    validation_date: generateDate(),
    validation_credit_period_start_date: generateDate(-365),
    validation_credit_period_end_date: generateDate(365),
    ...overrides,
  };
};

export const generateV2VerificationData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_verification_id: generateUuid(),
    verification_id: `VERIFICATION-${Date.now()}`,
    verification_start_date: generateDate(-180),
    verification_end_date: generateDate(180),
    verification_body: getRandomPicklistValue('verificationBody') || 'Test VVB',
    ...overrides,
  };
};

export const generateV2IssuanceData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_issuance_id: generateUuid(),
    issuance_id: `ISSUANCE-${Date.now()}`,
    issuance_date: generateDate(),
    ...overrides,
  };
};

export const generateV2UnitData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_unit_id: generateUuid(),
    unit_serial_id: `UNIT-${Date.now()}`,
    unit_start_block: '1000',
    unit_end_block: '2000',
    unit_count: 100.5,
    unit_type: getRandomPicklistValue('unitType') || 'VCU',
    unit_vintage_year: generateYear(),
    unit_status: getRandomPicklistValue('unitStatus') || 'Active',
    unit_status_reason: null,
    unit_status_date: null,
    unit_retirement_detail: null,
    unit_retirement_beneficiary: null,
    unit_retirement_beneficiary_id: null,
    unit_link: 'https://example.com/unit',
    unit_metric: getRandomPicklistValue('unitMetric') || 'tCO2e',
    unit_current_owner: null,
    unit_itmos_reference_id: null,
    ...overrides,
  };
};

export const generateV2LocationData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_location_id: generateUuid(),
    location_country: getRandomPicklistValue('locationCountry') || 'US',
    location_region: 'Test Region',
    location_gis: JSON.stringify({ type: 'Point', coordinates: [-122.4194, 37.7749] }),
    location_map_type: 'geojson',
    location_map_file_link: 'https://example.com/map.geojson',
    ...overrides,
  };
};

export const generateV2EstimationData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_estimation_id: generateUuid(),
    estimation_start_date: generateDate(-365),
    esitmation_end_date: generateDate(365), // Note: typo in schema
    estimation_unit_count: 1000.5,
    estimation_reference_no: `EST-REF-${Date.now()}`,
    ...overrides,
  };
};

export const generateV2RatingData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_rating_id: generateUuid(),
    rating_type: getRandomPicklistValue('ratingType') || 'Quality',
    rating_value: 'A+',
    rating_link: 'https://example.com/rating',
    ...overrides,
  };
};

export const generateV2CoBenefitData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_co_benefit_id: generateUuid(),
    co_benefit_id: getRandomPicklistValue('coBenefitId') || 'Biodiversity',
    ...overrides,
  };
};

// Join Tables
export const generateV2ProjectMethodologyData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_project_id: generateUuid(), // Should be provided via overrides
    cad_trust_methodology_id: generateUuid(), // Should be provided via overrides
    project_methodology_date: generateDate(),
    project_methodology_description: 'Test project methodology relationship',
    ...overrides,
  };
};

export const generateV2StakeholderData = async (overrides = {}) => {
  return {
    cad_trust_stakeholder_id: generateUuid(),
    stakeholder_name: 'Test Stakeholder',
    stakeholder_type: getRandomPicklistValue('stakeholderType') || 'Developer',
    stakeholder_link: 'https://example.com/stakeholder',
    ...overrides,
  };
};

export const generateV2StakeholderProjectData = async (overrides = {}) => {
  return {
    cad_trust_stakeholder_project_id: generateUuid(),
    cad_trust_stakeholder_id: generateUuid(), // Should be provided via overrides
    cad_trust_project_id: generateUuid(), // Should be provided via overrides
    ...overrides,
  };
};

export const generateV2LabelData = async (overrides = {}) => {
  return {
    cad_trust_label_id: generateUuid(),
    label_name: 'Test Label',
    label_type: getRandomPicklistValue('labelType') || 'Certification',
    label_link: 'https://example.com/label',
    label_date: generateDate(),
    ...overrides,
  };
};

export const generateV2UnitLabelData = async (overrides = {}) => {
  return {
    cad_trust_label_id: generateUuid(), // Should be provided via overrides
    cad_trust_unit_id: generateUuid(), // Should be provided via overrides
    label_unit_date: generateDate(),
    label_unit_description: 'Test unit label relationship',
    ...overrides,
  };
};

// AEF Tables
export const generateV2AefT1SubmissionData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_aef_t1_submission_id: generateUuid(),
    aef_t1_submission_party: 'Test Party',
    aef_t1_submission_version: '1.0',
    aef_t1_submission_report_year: generateYear(),
    aef_t1_submission_submission_date: generateDate(),
    aef_t1_submission_review_status: 'Pending',
    aef_t1_submission_result_check: 'Pass',
    aef_t1_submission_ndc_first_year: generateYear(),
    aef_t1_submission_ndc_last_year: generateYear() + 5,
    aef_t1_submission_reference_review_report: 'https://example.com/report',
    ...overrides,
  };
};

export const generateV2AefT5AuthorizedEntitiesData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_aef_t5_authorized_entities_id: generateUuid(),
    aef_t5_authorized_entities_authorization_date: generateDate(),
    aef_t5_authorized_entities_name: 'Test Authorized Entity',
    aef_t5_authorized_entities_incorporation_country: getRandomPicklistValue('locationCountry') || 'US',
    aef_t5_authorized_entities_Id: `AEF-T5-${Date.now()}`,
    aef_t5_authorized_entities_cooperative_approach_Id: `COOP-${Date.now()}`,
    aef_t5_authorized_entities_conditions: 'Test conditions',
    aef_t5_authorized_entities_change_conditions: 'Test change conditions',
    aef_t5_authorized_entities_additional_information: 'Test additional information',
    ...overrides,
  };
};

export const generateV2AefT2AuthorizationsData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_aef_t2_authorizations_id: generateUuid(),
    aef_t2_authorizations_id: `AEF-T2-${Date.now()}`,
    aef_t2_authorizations_date: generateDate(),
    aef_t2_authorizations_cooperative_approach_id: `COOP-${Date.now()}`,
    aef_t2_authorizations_version: '1.0',
    aef_t2_authorizations_quantity: 1000.5,
    aef_t2_authorizations_metric: getRandomPicklistValue('unitMetric') || 'tCO2e',
    aef_t2_authorizations_gwp_value: '1.0',
    aef_t2_authorizations_applicable_non_ghg_metric: null,
    aef_t2_authorizations_sector: getRandomPicklistValue('projectSector') || 'Energy',
    aef_t2_authorizations_activity_type: getRandomPicklistValue('projectType') || 'Renewable Energy',
    aef_t2_authorizations_purposes_for_authorization: getRandomPicklistValue('purpose') || 'Mitigation',
    aef_t2_authorizations_authorized_party_id: `PARTY-${Date.now()}`,
    aef_t2_authorizations_authozied_entity_id: `ENTITY-${Date.now()}`,
    aef_t2_authorizations_oimp_authorized_party: null,
    aef_t2_authorizations_authorized_timeframe: '2024-2030',
    aef_t2_authorizations_authorization_terms: 'Test authorization terms',
    aef_t2_authorizations_authorization_documentation: 'https://example.com/docs',
    aef_t2_authorizations_first_transfer_definition_oimp: 'Test definition',
    aef_t2_authorizations_additional_information: 'Test additional information',
    ...overrides,
  };
};

export const generateV2AefT3ActionsData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_aef_t3_actions_id: generateUuid(),
    aef_t3_actions_date: generateDate(),
    aef_t3_actions_type: getRandomPicklistValue('actionType') || 'Transfer',
    aef_t3_actions_subtype: 'Test subtype',
    aef_t3_actions_coopoerative_approach_id: `COOP-${Date.now()}`,
    aef_t3_actions_authorization_id: `AUTH-${Date.now()}`,
    aef_t3_actions_first_transferring_party_id: `PARTY-${Date.now()}`,
    aef_t3_actions_party_itmo_registry_id: `ITMO-${Date.now()}`,
    aef_t3_actions_itmo_first_id: `ITMO-FIRST-${Date.now()}`,
    aef_t3_actions_itmo_last_id: `ITMO-LAST-${Date.now()}`,
    aef_t3_actions_unit_registry_id: `UNIT-REG-${Date.now()}`,
    aef_t3_actions_unit_first_id: `UNIT-FIRST-${Date.now()}`,
    aef_t3_actions_unit_last_id: `UNIT-LAST-${Date.now()}`,
    aef_t3_actions_metric: getRandomPicklistValue('unitMetric') || 'tCO2e',
    aef_t3_actions_gwp_value: '1.0',
    aef_t3_actions_applicable_non_ghg_metric: null,
    aef_t3_actions_quantity_t_co2: 1000.5,
    aef_t3_actions_quantity_non_ghg: null,
    aef_t3_actions_mitigation_type: getRandomPicklistValue('mitigationType') || 'Reduction',
    aef_t3_actions_vintage_year: generateYear(),
    aef_t3_actions_transferring_party_id: `TRANSFER-${Date.now()}`,
    aef_t3_actions_acquiring_party_id: `ACQUIRE-${Date.now()}`,
    aef_t3_actions_purpose_of_use_oimp: 'Test purpose',
    aef_t3_actions_using_participating_party_id: null,
    aef_t3_actions_using_authorized_entity_id: null,
    aef_t3_actions_itmo_used_year: generateYear(),
    aef_t3_actions_consistency_check_result: 'Pass',
    aef_t3_actions_additional_information: 'Test additional information',
    ...overrides,
  };
};

export const generateV2AefT4HoldingsData = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  return {
    cad_trust_aef_t4_holdings_id: generateUuid(),
    aef_t4_holdings_coopoerative_approach_id: `COOP-${Date.now()}`,
    aef_t4_holdings_authorization_id: `AUTH-${Date.now()}`,
    aef_t4_holdings_first_transferring_party_id: `PARTY-${Date.now()}`,
    aef_t4_holdings_party_itmo_registry_id: `ITMO-${Date.now()}`,
    aef_t4_holdings_itmo_first_id: `ITMO-FIRST-${Date.now()}`,
    aef_t4_holdings_itmo_last_id: `ITMO-LAST-${Date.now()}`,
    aef_t4_holdings_unit_registry_id: `UNIT-REG-${Date.now()}`,
    aef_t4_holdings_unit_first_id: `UNIT-FIRST-${Date.now()}`,
    aef_t4_holdings_unit_last_id: `UNIT-LAST-${Date.now()}`,
    aef_t4_holdings_metric: getRandomPicklistValue('unitMetric') || 'tCO2e',
    aef_t4_holdings_gwp_value: '1.0',
    aef_t4_holdings_applicable_non_ghg_metric: null,
    aef_t4_holdings_quantity_t_co2: 1000.5,
    aef_t4_holdings_quantity_non_ghg: null,
    aef_t4_holdings_mitigation_type: getRandomPicklistValue('mitigationType') || 'Reduction',
    aef_t4_holdings_vintage_year: generateYear(),
    ...overrides,
  };
};

/**
 * Complete Dataset Generators
 * These generators create complete datasets with all dependencies
 */

/**
 * Generate complete project dataset with all child tables
 */
export const generateV2CompleteProjectDataset = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  // Create parent records
  const program = await generateV2ProgramData(overrides.program);
  const project = await generateV2ProjectData({
    ...overrides.project,
    cad_trust_program_id: program.cad_trust_program_id,
  });
  const methodology = await generateV2MethodologyData(overrides.methodology);
  const location = await generateV2LocationData({
    ...overrides.location,
    cad_trust_project_id: project.cad_trust_project_id,
  });
  const validation = await generateV2ValidationData({
    ...overrides.validation,
    cad_trust_project_id: project.cad_trust_project_id,
  });
  const verification = await generateV2VerificationData({
    ...overrides.verification,
    cad_trust_project_id: project.cad_trust_project_id,
    cad_trust_validation_id: validation.cad_trust_validation_id,
  });
  const issuance = await generateV2IssuanceData({
    ...overrides.issuance,
    cad_trust_verification_id: verification.cad_trust_verification_id,
    cad_trust_methodology_id: methodology.cad_trust_methodology_id,
    cad_trust_location_id: location.cad_trust_location_id,
  });

  // Create child records
  const estimation = await generateV2EstimationData({
    ...overrides.estimation,
    cad_trust_project_id: project.cad_trust_project_id,
  });
  const rating = await generateV2RatingData({
    ...overrides.rating,
    cad_trust_project_id: project.cad_trust_project_id,
  });
  const coBenefit = await generateV2CoBenefitData({
    ...overrides.coBenefit,
    cad_trust_project_id: project.cad_trust_project_id,
  });
  const projectMethodology = await generateV2ProjectMethodologyData({
    ...overrides.projectMethodology,
    cad_trust_project_id: project.cad_trust_project_id,
    cad_trust_methodology_id: methodology.cad_trust_methodology_id,
  });

  return {
    program,
    project,
    methodology,
    location,
    validation,
    verification,
    issuance,
    estimation,
    rating,
    coBenefit,
    projectMethodology,
  };
};

/**
 * Generate complete unit dataset with all dependencies
 */
export const generateV2CompleteUnitDataset = async (overrides = {}) => {
  await ensurePicklistsInitialized();

  // Create all dependencies first
  const projectDataset = await generateV2CompleteProjectDataset(overrides.projectDataset);

  // Create unit
  const unit = await generateV2UnitData({
    ...overrides.unit,
    cad_trust_issuance_id: projectDataset.issuance.cad_trust_issuance_id,
  });

  // Create label and unit-label relationship
  const label = await generateV2LabelData(overrides.label);
  const unitLabel = await generateV2UnitLabelData({
    ...overrides.unitLabel,
    cad_trust_unit_id: unit.cad_trust_unit_id,
    cad_trust_label_id: label.cad_trust_label_id,
  });

  return {
    ...projectDataset,
    unit,
    label,
    unitLabel,
  };
};

/**
 * Generate staging records for different scenarios
 */
export const generateV2CompleteStagingDataset = async (scenario = 'single', overrides = {}) => {
  await ensurePicklistsInitialized();

  switch (scenario) {
    case 'single':
      // One table with one record
      const singleProject = await generateV2ProjectData(overrides.project);
      return {
        project: [singleProject],
      };

    case 'multiple':
      // Multiple tables with one record each
      const program = await generateV2ProgramData(overrides.program);
      const project = await generateV2ProjectData({
        ...overrides.project,
        cad_trust_program_id: program.cad_trust_program_id,
      });
      const methodology = await generateV2MethodologyData(overrides.methodology);
      return {
        program: [program],
        project: [project],
        methodology: [methodology],
      };

    case 'complex':
      // Multiple tables with multiple records and relationships
      const complexDataset = await generateV2CompleteProjectDataset(overrides);
      return {
        program: [complexDataset.program],
        project: [complexDataset.project],
        methodology: [complexDataset.methodology],
        location: [complexDataset.location],
        validation: [complexDataset.validation],
        verification: [complexDataset.verification],
        issuance: [complexDataset.issuance],
        estimation: [complexDataset.estimation],
        rating: [complexDataset.rating],
        coBenefit: [complexDataset.coBenefit],
        projectMethodology: [complexDataset.projectMethodology],
      };

    case 'all':
      // All 21 tables with sample data
      const allDataset = await generateV2CompleteUnitDataset(overrides);
      const stakeholder = await generateV2StakeholderData(overrides.stakeholder);
      const stakeholderProject = await generateV2StakeholderProjectData({
        ...overrides.stakeholderProject,
        cad_trust_stakeholder_id: stakeholder.cad_trust_stakeholder_id,
        cad_trust_project_id: allDataset.project.cad_trust_project_id,
      });
      const aefT1 = await generateV2AefT1SubmissionData(overrides.aefT1);
      const aefT5 = await generateV2AefT5AuthorizedEntitiesData({
        ...overrides.aefT5,
        cad_trust_aef_t1_submission_id: aefT1.cad_trust_aef_t1_submission_id,
        cad_trust_unit_id: allDataset.unit.cad_trust_unit_id,
        cad_trust_project_id: allDataset.project.cad_trust_project_id,
      });
      const aefT2 = await generateV2AefT2AuthorizationsData({
        ...overrides.aefT2,
        cad_trust_aef_t1_submission_id: aefT1.cad_trust_aef_t1_submission_id,
        cad_trust_unit_id: allDataset.unit.cad_trust_unit_id,
        cad_trust_project_id: allDataset.project.cad_trust_project_id,
        cad_trust_aef_t5_authorized_entities_id: aefT5.cad_trust_aef_t5_authorized_entities_id,
      });
      const aefT3 = await generateV2AefT3ActionsData({
        ...overrides.aefT3,
        cad_trust_aef_t1_submission_id: aefT1.cad_trust_aef_t1_submission_id,
        cad_trust_unit_id: allDataset.unit.cad_trust_unit_id,
        cad_trust_project_id: allDataset.project.cad_trust_project_id,
        cad_trust_aef_t2_authorizations_id: aefT2.cad_trust_aef_t2_authorizations_id,
      });
      const aefT4 = await generateV2AefT4HoldingsData({
        ...overrides.aefT4,
        cad_trust_aef_t1_submission_id: aefT1.cad_trust_aef_t1_submission_id,
        cad_trust_unit_id: allDataset.unit.cad_trust_unit_id,
        cad_trust_project_id: allDataset.project.cad_trust_project_id,
        cad_trust_aef_t2_authorizations_id: aefT2.cad_trust_aef_t2_authorizations_id,
      });

      return {
        program: [allDataset.program],
        project: [allDataset.project],
        methodology: [allDataset.methodology],
        location: [allDataset.location],
        validation: [allDataset.validation],
        verification: [allDataset.verification],
        issuance: [allDataset.issuance],
        unit: [allDataset.unit],
        estimation: [allDataset.estimation],
        rating: [allDataset.rating],
        coBenefit: [allDataset.coBenefit],
        projectMethodology: [allDataset.projectMethodology],
        stakeholder: [stakeholder],
        stakeholderProject: [stakeholderProject],
        label: [allDataset.label],
        unitLabel: [allDataset.unitLabel],
        aefT1Submission: [aefT1],
        aefT5AuthorizedEntities: [aefT5],
        aefT2Authorizations: [aefT2],
        aefT3Actions: [aefT3],
        aefT4Holdings: [aefT4],
      };

    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
};

/**
 * Staging Record Generators
 */

/**
 * Create a properly formatted staging record for a model
 */
export const createV2StagingRecordForModel = async (modelName, action, data, overrides = {}) => {
  const { StagingV2 } = await import('../../../src/models/v2/index.js');

  // Convert model name to table name (handle camelCase to snake_case if needed)
  const tableName = modelName.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();

  // Ensure data is an array
  const recordsArray = Array.isArray(data) ? data : [data];

  return {
    uuid: generateUuid(),
    table: tableName,
    action: action.toUpperCase(), // INSERT, UPDATE, DELETE
    data: JSON.stringify(recordsArray),
    committed: false,
    failed_commit: false,
    is_transfer: false,
    ...overrides,
  };
};

/**
 * Create staging records for a complete dataset
 */
export const createV2StagingRecordsForDataset = async (dataset, action = 'INSERT') => {
  const stagingRecords = [];

  // Map of dataset keys to table names
  const tableMap = {
    program: 'program',
    project: 'project',
    methodology: 'methodology',
    location: 'location',
    validation: 'validation',
    verification: 'verification',
    issuance: 'issuance',
    unit: 'unit',
    estimation: 'estimation',
    rating: 'rating',
    coBenefit: 'co_benefit',
    projectMethodology: 'project_methodology',
    stakeholder: 'stakeholder',
    stakeholderProject: 'stakeholder_projects',
    label: 'label',
    unitLabel: 'unit_label',
    aefT1Submission: 'aef_t1_submission',
    aefT5AuthorizedEntities: 'aef_t5_authorized_entities',
    aefT2Authorizations: 'aef_t2_authorizations',
    aefT3Actions: 'aef_t3_actions',
    aefT4Holdings: 'aef_t4_holdings',
  };

  for (const [key, tableName] of Object.entries(tableMap)) {
    if (dataset[key]) {
      const records = Array.isArray(dataset[key]) ? dataset[key] : [dataset[key]];
      const stagingRecord = await createV2StagingRecordForModel(tableName, action, records);
      stagingRecords.push(stagingRecord);
    }
  }

  return stagingRecords;
};

/**
 * Generate staging records ready for commit
 */
export const generateV2StagingRecordsForCommit = async (tableNames = [], count = 1, overrides = {}) => {
  await ensurePicklistsInitialized();

  const stagingRecords = [];

  // If no table names specified, use all tables
  const allTables = [
    'program', 'project', 'methodology', 'location', 'validation', 'verification',
    'issuance', 'unit', 'estimation', 'rating', 'co_benefit', 'project_methodology',
    'stakeholder', 'stakeholder_projects', 'label', 'unit_label',
    'aef_t1_submission', 'aef_t5_authorized_entities', 'aef_t2_authorizations',
    'aef_t3_actions', 'aef_t4_holdings',
  ];

  const tablesToGenerate = tableNames.length > 0 ? tableNames : allTables;

  for (const tableName of tablesToGenerate) {
    for (let i = 0; i < count; i++) {
      let data;

      // Generate appropriate data for each table
      switch (tableName) {
        case 'program':
          data = await generateV2ProgramData(overrides.program);
          break;
        case 'project':
          data = await generateV2ProjectData(overrides.project);
          break;
        case 'methodology':
          data = await generateV2MethodologyData(overrides.methodology);
          break;
        case 'location':
          data = await generateV2LocationData(overrides.location);
          break;
        case 'validation':
          data = await generateV2ValidationData(overrides.validation);
          break;
        case 'verification':
          data = await generateV2VerificationData(overrides.verification);
          break;
        case 'issuance':
          data = await generateV2IssuanceData(overrides.issuance);
          break;
        case 'unit':
          data = await generateV2UnitData(overrides.unit);
          break;
        case 'estimation':
          data = await generateV2EstimationData(overrides.estimation);
          break;
        case 'rating':
          data = await generateV2RatingData(overrides.rating);
          break;
        case 'co_benefit':
          data = await generateV2CoBenefitData(overrides.coBenefit);
          break;
        case 'project_methodology':
          data = await generateV2ProjectMethodologyData(overrides.projectMethodology);
          break;
        case 'stakeholder':
          data = await generateV2StakeholderData(overrides.stakeholder);
          break;
        case 'stakeholder_projects':
          data = await generateV2StakeholderProjectData(overrides.stakeholderProject);
          break;
        case 'label':
          data = await generateV2LabelData(overrides.label);
          break;
        case 'unit_label':
          data = await generateV2UnitLabelData(overrides.unitLabel);
          break;
        case 'aef_t1_submission':
          data = await generateV2AefT1SubmissionData(overrides.aefT1);
          break;
        case 'aef_t5_authorized_entities':
          data = await generateV2AefT5AuthorizedEntitiesData(overrides.aefT5);
          break;
        case 'aef_t2_authorizations':
          data = await generateV2AefT2AuthorizationsData(overrides.aefT2);
          break;
        case 'aef_t3_actions':
          data = await generateV2AefT3ActionsData(overrides.aefT3);
          break;
        case 'aef_t4_holdings':
          data = await generateV2AefT4HoldingsData(overrides.aefT4);
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }

      const stagingRecord = await createV2StagingRecordForModel(tableName, 'INSERT', data);
      stagingRecords.push(stagingRecord);
    }
  }

  return stagingRecords;
};

