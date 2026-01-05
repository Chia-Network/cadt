'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('co_benefit', {
      cad_trust_co_benefit_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      co_benefit_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'picklist'
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
    await queryInterface.addIndex('co_benefit', ['co_benefit_id']);
    await queryInterface.addIndex('co_benefit', ['cad_trust_project_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('co_benefit');
  },
};
