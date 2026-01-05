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

// getV2PrimaryKeyField moved to v2-primary-key-utils.js to avoid circular dependency
export { getV2PrimaryKeyField } from './v2-primary-key-utils.js';

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

