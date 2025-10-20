'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'aef_t3_actions',
      {
        cad_trust_aef_t3_actions_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
        },
        aef_t3_actions_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        aef_t3_actions_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_subtype: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_coopoerative_approach_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_authorization_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_first_transferring_party_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_party_itmo_registry_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_itmo_first_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_itmo_last_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_unit_registry_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_unit_first_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_unit_last_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_metric: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_gwp_value: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_applicable_non_ghg_metric: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_quantity_t_co2: {
          type: Sequelize.DECIMAL(20, 8),
          allowNull: false,
        },
        aef_t3_actions_quantity_non_ghg: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_mitigation_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_vintage_year: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        aef_t3_actions_transferring_party_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_acquiring_party_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t3_actions_purpose_of_use_oimp: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_using_participating_party_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_using_authorized_entity_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_itmo_used_year: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        aef_t3_actions_consistency_check_result: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t3_actions_additional_information: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
        cad_trust_aef_t1_submission_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'aef_t1_submission',
            key: 'cad_trust_aef_t1_submission_id',
          },
        },
        cad_trust_unit_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'unit',
            key: 'cad_trust_unit_id',
          },
        },
        cad_trust_project_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'project',
            key: 'cad_trust_project_id',
          },
        },
        cad_trust_aef_t2_authorizations_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'aef_t2_authorizations',
            key: 'cad_trust_aef_t2_authorizations_id',
          },
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('aef_t3_actions');
  },
};
