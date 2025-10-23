'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('validation', {
      cad_trust_validation_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      validation_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      validation_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      validation_body: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      validation_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      validation_credit_period_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      validation_credit_period_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      cad_trust_project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'project',
          key: 'cad_trust_project_id',
        },
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
    await queryInterface.addIndex('validation', ['validation_id']);
    await queryInterface.addIndex('validation', ['validation_type']);
    await queryInterface.addIndex('validation', ['validation_body']);
    await queryInterface.addIndex('validation', ['validation_date']);
    await queryInterface.addIndex('validation', ['cad_trust_project_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('validation');
  },
};
