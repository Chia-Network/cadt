'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('unit', {
      cad_trust_unit_id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      unit_serial_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      unit_start_block: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      unit_end_block: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      unit_count: {
        type: Sequelize.DECIMAL,
        allowNull: true,
      },
      unit_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_vintage_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      unit_status: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_status_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      unit_status_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      unit_retirement_detail: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      unit_retirement_beneficiary: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_retirement_beneficiary_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_link: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      unit_metric: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_current_owner: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_itmos_reference_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cad_trust_issuance_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        comment: 'Foreign key to issuance table'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('unit', ['unit_serial_id']);
    await queryInterface.addIndex('unit', ['unit_vintage_year']);
    await queryInterface.addIndex('unit', ['unit_status']);
    await queryInterface.addIndex('unit', ['cad_trust_issuance_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('unit');
  },
};
