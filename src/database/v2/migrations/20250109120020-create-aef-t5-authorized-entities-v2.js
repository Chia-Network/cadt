'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'aef_t5_authorized_entities',
      {
        cad_trust_aef_t5_authorized_entities_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
        },
        aef_t5_authorized_entities_authorization_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        aef_t5_authorized_entities_name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t5_authorized_entities_incorporation_country: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t5_authorized_entities_Id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t5_authorized_entities_cooperative_approach_Id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t5_authorized_entities_conditions: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        aef_t5_authorized_entities_change_conditions: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        aef_t5_authorized_entities_additional_information: {
          type: Sequelize.TEXT,
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
    await queryInterface.dropTable('aef_t5_authorized_entities');
  },
};
