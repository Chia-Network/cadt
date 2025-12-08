'use strict';

import { Mutex } from 'async-mutex';
import {
  ProgramV2,
  MethodologyV2,
  ProjectV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ProjectMethodologyV2,
  StakeholderV2,
  StakeholderProjectV2,
  LabelV2,
  UnitLabelV2,
  AefT1SubmissionV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
} from '../models/v2/index.js';

/**
 * Maps datalayer keys (e.g., "project|{uuid}") to V2 Sequelize models
 * Used by sync-registries-v2 task to identify which model to upsert/delete
 */
export const ModelKeysV2 = {
  program: ProgramV2,
  methodology: MethodologyV2,
  project: ProjectV2,
  validation: ValidationV2,
  verification: VerificationV2,
  issuance: IssuanceV2,
  unit: UnitV2,
  location: LocationV2,
  estimation: EstimationV2,
  rating: RatingV2,
  co_benefit: CoBenefitV2,
  project_methodology: ProjectMethodologyV2,
  stakeholder: StakeholderV2,
  stakeholder_projects: StakeholderProjectV2,
  label: LabelV2,
  unit_label: UnitLabelV2,
  aef_t1_submission: AefT1SubmissionV2,
  aef_t5_authorized_entities: AefT5AuthorizedEntitiesV2,
  aef_t2_authorizations: AefT2AuthorizationsV2,
  aef_t3_actions: AefT3ActionsV2,
  aef_t4_holdings: AefT4HoldingsV2,
};

/**
 * Gets the primary key field name for a V2 model
 * @param {string} modelKey - The model key (e.g., 'project', 'unit', 'project_methodology')
 * @returns {string|null} The primary key field name (e.g., 'cad_trust_project_id', 'id')
 */
export const getV2PrimaryKeyField = (modelKey) => {
  const primaryKeyMap = {
    program: 'cad_trust_program_id',
    methodology: 'cad_trust_methodology_id',
    project: 'cad_trust_project_id',
    validation: 'cad_trust_validation_id',
    verification: 'cad_trust_verification_id',
    issuance: 'cad_trust_issuance_id',
    unit: 'cad_trust_unit_id',
    location: 'cad_trust_location_id',
    estimation: 'cad_trust_estimation_id',
    rating: 'cad_trust_rating_id',
    co_benefit: 'cad_trust_co_benefit_id',
    project_methodology: 'id',
    stakeholder: 'cad_trust_stakeholder_id',
    stakeholder_projects: 'id',
    label: 'cad_trust_label_id',
    unit_label: 'id',
    aef_t1_submission: 'cad_trust_aef_t1_submission_id',
    aef_t5_authorized_entities: 'cad_trust_aef_t5_authorized_entities_id',
    aef_t2_authorizations: 'cad_trust_aef_t2_authorizations_id',
    aef_t3_actions: 'cad_trust_aef_t3_actions_id',
    aef_t4_holdings: 'cad_trust_aef_t4_holdings_id',
  };
  return primaryKeyMap[modelKey] || null;
};

/**
 * Mutex which must be acquired to run the sync-registries-v2 task job.
 * This mutex exists to prevent multiple registry sync tasks from running at the same time
 * and overloading the chia RPC's or causing a SQLite locking error due to multiple task
 * instances trying to commit large update transactions.
 * @type {Mutex}
 */
export const syncRegistriesTaskMutexV2 = new Mutex();

/**
 * Mutex which must be acquired when writing registry update information until the transaction
 * has been committed. Audit model update transactions are large and lock the DB for long periods.
 * @type {Mutex}
 */
export const processingSyncRegistriesTransactionMutexV2 = new Mutex();

