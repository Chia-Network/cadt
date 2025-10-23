'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('verification', {
      cad_trust_verification_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      verification_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      verification_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      verification_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      verification_body: {
        type: Sequelize.STRING,
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
      cad_trust_validation_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'validation',
          key: 'cad_trust_validation_id',
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
    await queryInterface.addIndex('verification', ['verification_id']);
    await queryInterface.addIndex('verification', ['verification_body']);
    await queryInterface.addIndex('verification', ['verification_start_date']);
    await queryInterface.addIndex('verification', ['verification_end_date']);
    await queryInterface.addIndex('verification', ['cad_trust_project_id']);
    await queryInterface.addIndex('verification', ['cad_trust_validation_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('verification');
  },
};
