'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estimation', {
      cad_trust_estimation_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      estimation_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      estimation_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      estimation_unit_count: {
        type: Sequelize.DECIMAL(20, 6),
        allowNull: true,
      },
      estimation_reference_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cad_trust_project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Foreign key to project table'
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
    await queryInterface.addIndex('estimation', ['estimation_start_date']);
    await queryInterface.addIndex('estimation', ['estimation_end_date']);
    await queryInterface.addIndex('estimation', ['cad_trust_project_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('estimation');
  },
};
