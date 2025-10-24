'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stakeholder', {
      cad_trust_stakeholder_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      stakeholder_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      stakeholder_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from type'
      },
      stakeholder_link: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'html'
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
    await queryInterface.addIndex('stakeholder', ['stakeholder_name']);
    await queryInterface.addIndex('stakeholder', ['stakeholder_type']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('stakeholder');
  },
};
