'use strict';

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
    stakeholder_projects: 'cad_trust_stakeholder_project_id',
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

